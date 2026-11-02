// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { commitMergeFamilies } from './commit-merge-families'
import type { DraftScope } from './draft-scope'
import { previewMergeFamilies } from './preview-merge-families'

let raw: PrismaClient
let scope: DraftScope
let sourceId: string
let targetId: string

describe.skipIf(!process.env.DATABASE_URL)('MCP family merge against PostgreSQL', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })
  beforeEach(async () => {
    const suffix = randomUUID()
    const school = await raw.school.create({
      data: { name: 'MCP merge', slug: `mcp-merge-${suffix}` },
    })
    const admin = await raw.user.create({ data: { email: `mcp-merge-${suffix}@test.invalid` } })
    scope = {
      schoolId: school.id,
      userId: admin.id,
      owner: { kind: 'ADMIN_SESSION', userId: admin.id },
      paymentsEnabled: false,
    }
    await raw.schoolMember.create({
      data: { schoolId: school.id, userId: admin.id, roles: ['ADMIN'] },
    })
    const source = await raw.family.create({
      data: { schoolId: school.id, name: 'Source', createdById: admin.id },
    })
    const target = await raw.family.create({
      data: { schoolId: school.id, name: 'Target', createdById: admin.id },
    })
    sourceId = source.id
    targetId = target.id
    for (const familyId of [sourceId, targetId]) {
      await raw.person.create({
        data: {
          schoolId: school.id,
          name: 'Child',
          lastname: familyId === sourceId ? 'Source' : 'Target',
          families: { create: { familyId, relationType: 'OTHER' } },
          student: { create: {} },
        },
      })
    }
  })
  afterEach(async () => {
    await raw.mcpDraft.deleteMany({ where: { schoolId: scope.schoolId } })
    const families = await raw.family.findMany({
      where: { schoolId: scope.schoolId },
      select: { id: true },
    })
    for (const family of families) await familyGateway.deleteWithRelated(scope.schoolId, family.id)
    await raw.schoolMember.deleteMany({ where: { schoolId: scope.schoolId } })
    await raw.school.delete({ where: { id: scope.schoolId } })
    await raw.user.delete({ where: { id: scope.userId } })
  })
  afterAll(async () => {
    await raw?.$disconnect()
  })

  async function preview() {
    const result = await previewMergeFamilies(scope, { sourceId, targetId })
    if (typeof result === 'string' || !result.draftId || !result.checksum)
      throw new Error('Expected preview')
    return { draftId: result.draftId, checksum: result.checksum }
  }

  it('creates a draft only, then merges and persists the same idempotent replay result', async () => {
    const confirmation = await preview()
    expect(await raw.family.count({ where: { schoolId: scope.schoolId, isActive: true } })).toBe(2)
    const result = await commitMergeFamilies(scope, confirmation)
    expect(result).toEqual({ sourceId, targetId, sourceArchived: true, merged: true })
    expect(await raw.family.count({ where: { schoolId: scope.schoolId, isActive: true } })).toBe(1)
    expect(
      await raw.familyPerson.count({ where: { schoolId: scope.schoolId, familyId: targetId } })
    ).toBe(2)
    expect(await raw.student.count({ where: { schoolId: scope.schoolId } })).toBe(2)
    const stored = await raw.mcpDraft.findFirst({
      where: { schoolId: scope.schoolId, id: confirmation.draftId },
    })
    expect(stored).toMatchObject({ status: 'COMMITTED', result })
    expect(await commitMergeFamilies(scope, confirmation)).toEqual(result)
  })

  it('refuses a newly added child without archiving the source or consuming the draft', async () => {
    const confirmation = await preview()
    await raw.person.create({
      data: {
        schoolId: scope.schoolId,
        name: 'Added',
        lastname: 'Child',
        families: { create: { familyId: sourceId, relationType: 'OTHER' } },
        student: { create: {} },
      },
    })
    expect(await commitMergeFamilies(scope, confirmation)).toBe('staleDraft')
    expect(await raw.family.count({ where: { schoolId: scope.schoolId, isActive: true } })).toBe(2)
    expect(
      await raw.familyPerson.count({ where: { schoolId: scope.schoolId, familyId: sourceId } })
    ).toBe(2)
    expect(
      await raw.mcpDraft.findFirst({
        where: { schoolId: scope.schoolId, id: confirmation.draftId },
      })
    ).toMatchObject({ status: 'PENDING', result: null })
  })
})
