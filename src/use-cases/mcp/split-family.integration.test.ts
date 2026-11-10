// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { commitSplitFamily } from './commit-split-family'
import type { DraftScope } from './draft-scope'
import { previewSplitFamily } from './preview-split-family'

let raw: PrismaClient
let scope: DraftScope
let sourceId: string
let stayPersonId: string
let movePersonId: string
let stayEnrollmentId: string
let moveEnrollmentId: string

describe.skipIf(!process.env.DATABASE_URL)('MCP family split against PostgreSQL', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })
  beforeEach(async () => {
    const suffix = randomUUID()
    const school = await raw.school.create({
      data: { name: 'MCP split', slug: `mcp-split-${suffix}` },
    })
    const admin = await raw.user.create({ data: { email: `mcp-split-${suffix}@test.invalid` } })
    scope = {
      schoolId: school.id,
      userId: admin.id,
      owner: { kind: 'ADMIN_SESSION', userId: admin.id },
      paymentsEnabled: true,
    }
    await raw.schoolMember.create({
      data: { schoolId: school.id, userId: admin.id, roles: ['ADMIN'] },
    })
    const source = await raw.family.create({
      data: { schoolId: school.id, name: 'Homonym', createdById: admin.id },
    })
    sourceId = source.id
    const plan = await raw.plan.create({
      data: { schoolId: school.id, name: 'Forfait', amount: 1000 },
    })
    const enroll = async (name: string) => {
      const person = await raw.person.create({
        data: {
          schoolId: school.id,
          name,
          lastname: 'Homonym',
          families: { create: { familyId: sourceId, relationType: 'OTHER' } },
          student: { create: {} },
        },
        include: { student: true },
      })
      const enrollment = await raw.enrollment.create({
        data: {
          schoolId: school.id,
          studentId: person.student?.id ?? '',
          planId: plan.id,
          totalAmount: 1000,
          status: 'ACTIVE',
        },
      })
      return { personId: person.id, enrollmentId: enrollment.id }
    }
    const stay = await enroll('Stay')
    const move = await enroll('Move')
    stayPersonId = stay.personId
    movePersonId = move.personId
    stayEnrollmentId = stay.enrollmentId
    moveEnrollmentId = move.enrollmentId
    for (const enrollmentId of [stayEnrollmentId, moveEnrollmentId]) {
      await raw.payment.create({
        data: {
          schoolId: school.id,
          familyId: sourceId,
          enrollmentId,
          amount: 160,
          method: 'CASH',
          paidAt: new Date('2026-10-30'),
        },
      })
    }
  })
  afterEach(async () => {
    const { schoolId } = scope
    await raw.mcpDraft.deleteMany({ where: { schoolId } })
    await raw.payment.deleteMany({ where: { schoolId } })
    await raw.receipt.deleteMany({ where: { schoolId } })
    await raw.enrollment.deleteMany({ where: { schoolId } })
    const families = await raw.family.findMany({ where: { schoolId }, select: { id: true } })
    for (const family of families) await familyGateway.deleteWithRelated(schoolId, family.id)
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.schoolMember.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.user.delete({ where: { id: scope.userId } })
  })
  afterAll(async () => {
    await raw?.$disconnect()
  })

  async function preview(personIds = [movePersonId]) {
    const result = await previewSplitFamily(scope, {
      sourceId,
      personIds,
      name: 'Homonym (Move)',
    })
    if (typeof result === 'string') throw new Error(result)
    return result
  }

  it('moves the member and its payment to a new family and replays the same result', async () => {
    const draft = await preview()
    expect(draft.blockers).toEqual([])
    if (!draft.draftId || !draft.checksum) throw new Error('Expected draft')
    expect(await raw.family.count({ where: { schoolId: scope.schoolId } })).toBe(1)

    const result = await commitSplitFamily(scope, {
      draftId: draft.draftId,
      checksum: draft.checksum,
    })
    if (typeof result !== 'object' || result === null || !('familyId' in result))
      throw new Error(String(result))
    expect(result).toMatchObject({ sourceId, name: 'Homonym (Move)', split: true })

    const links = await raw.familyPerson.findMany({ where: { schoolId: scope.schoolId } })
    expect(links.map((link) => [link.personId, link.familyId]).sort()).toEqual(
      [
        [stayPersonId, sourceId],
        [movePersonId, result.familyId],
      ].sort()
    )
    const payments = await raw.payment.findMany({ where: { schoolId: scope.schoolId } })
    expect(
      Object.fromEntries(payments.map((payment) => [payment.enrollmentId, payment.familyId]))
    ).toEqual({ [stayEnrollmentId]: sourceId, [moveEnrollmentId]: result.familyId })
    expect(
      await commitSplitFamily(scope, { draftId: draft.draftId, checksum: draft.checksum })
    ).toEqual(result)
  })

  it('refuses to move every member, which is a rename rather than a split', async () => {
    const draft = await preview([movePersonId, stayPersonId])
    expect(draft.draftId).toBeNull()
    expect(draft.blockers).toEqual([{ field: 'family', value: '', reason: 'nothingRemains' }])
  })

  it('refuses a receipt that covers students on both sides', async () => {
    const receipt = await raw.receipt.create({
      data: {
        schoolId: scope.schoolId,
        familyId: sourceId,
        number: 1,
        total: 320,
        method: 'CASH',
        paidAt: new Date('2026-10-30'),
        idempotencyKey: randomUUID(),
        requestHash: randomUUID(),
      },
    })
    await raw.payment.updateMany({
      where: { schoolId: scope.schoolId },
      data: { receiptId: receipt.id },
    })
    const draft = await preview()
    expect(draft.blockers).toEqual([{ field: 'family', value: '', reason: 'sharedReceipt' }])
  })

  it('refuses a stale plan without writing anything or consuming the draft', async () => {
    const draft = await preview()
    if (!draft.draftId || !draft.checksum) throw new Error('Expected draft')
    await raw.payment.create({
      data: {
        schoolId: scope.schoolId,
        familyId: sourceId,
        enrollmentId: moveEnrollmentId,
        amount: 50,
        method: 'CASH',
        paidAt: new Date('2026-11-02'),
      },
    })
    expect(
      await commitSplitFamily(scope, { draftId: draft.draftId, checksum: draft.checksum })
    ).toBe('staleDraft')
    expect(await raw.family.count({ where: { schoolId: scope.schoolId } })).toBe(1)
    expect(
      await raw.mcpDraft.findFirst({ where: { schoolId: scope.schoolId, id: draft.draftId } })
    ).toMatchObject({ status: 'PENDING', result: null })
  })
})
