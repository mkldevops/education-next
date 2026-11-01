// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { mergeFamilies } from './merge-families'

let raw: PrismaClient
let schoolId: string
let userId: string
let sourceId: string
let targetId: string

describe.skipIf(!process.env.DATABASE_URL)('merge families against PostgreSQL', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })
  beforeEach(async () => {
    const suffix = randomUUID()
    const school = await raw.school.create({
      data: { name: 'Merge test', slug: `merge-${suffix}` },
    })
    schoolId = school.id
    const user = await raw.user.create({ data: { email: `merge-${suffix}@test.invalid` } })
    userId = user.id
    await raw.schoolMember.create({ data: { schoolId, userId, roles: ['PARENT'] } })
    const source = await raw.family.create({
      data: { schoolId, name: 'Source', createdById: userId },
    })
    const target = await raw.family.create({
      data: { schoolId, name: 'Target', createdById: userId },
    })
    sourceId = source.id
    targetId = target.id
  })
  afterEach(async () => {
    const families = await raw.family.findMany({ where: { schoolId }, select: { id: true } })
    for (const family of families) await familyGateway.deleteWithRelated(schoolId, family.id)
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.schoolMember.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.user.delete({ where: { id: userId } })
  })
  afterAll(async () => {
    await raw?.$disconnect()
  })

  it('preserves archived payments, receipt, transaction, invitations and duplicate account links', async () => {
    const person = await raw.person.create({
      data: { schoolId, name: 'Child', lastname: 'Source' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    await raw.familyPerson.create({
      data: { schoolId, familyId: sourceId, personId: person.id, relationType: 'OTHER' },
    })
    const plan = await raw.plan.create({ data: { schoolId, name: 'Plan', amount: 100 } })
    const enrollment = await raw.enrollment.create({
      data: {
        schoolId,
        studentId: student.id,
        planId: plan.id,
        totalAmount: 100,
        status: 'ACTIVE',
      },
    })
    const transaction = await raw.paymentTransaction.create({
      data: {
        schoolId,
        familyId: sourceId,
        initiatedById: userId,
        amount: 50,
        provider: 'STRIPE',
        status: 'SUCCEEDED',
      },
    })
    const receipt = await raw.receipt.create({
      data: {
        schoolId,
        familyId: sourceId,
        number: 1,
        total: 50,
        method: 'CASH',
        paidAt: new Date(),
        recordedById: userId,
        idempotencyKey: randomUUID(),
        requestHash: 'test',
      },
    })
    const payment = await raw.payment.create({
      data: {
        schoolId,
        familyId: sourceId,
        enrollmentId: enrollment.id,
        paymentTransactionId: transaction.id,
        receiptId: receipt.id,
        amount: 50,
        method: 'CASH',
        paidAt: new Date(),
        isActive: false,
      },
    })
    const invitation = await raw.invitation.create({
      data: {
        schoolId,
        familyId: sourceId,
        personId: person.id,
        createdById: userId,
        email: 'invited@test.invalid',
        token: randomUUID(),
        expiresAt: new Date('2027-01-01'),
      },
    })
    await raw.userFamily.createMany({
      data: [sourceId, targetId].map((familyId) => ({ schoolId, familyId, userId })),
    })

    expect(await mergeFamilies({ schoolId, sourceId, targetId })).toBe('OK')
    expect(await raw.family.findFirst({ where: { schoolId, id: sourceId } })).toMatchObject({
      isActive: false,
    })
    expect(
      await raw.familyPerson.findMany({ where: { schoolId, personId: person.id } })
    ).toMatchObject([{ familyId: targetId }])
    expect(await raw.userFamily.findMany({ where: { schoolId, userId } })).toMatchObject([
      { familyId: targetId },
    ])
    expect(await raw.payment.findFirst({ where: { schoolId, id: payment.id } })).toMatchObject({
      familyId: targetId,
      isActive: false,
      enrollmentId: enrollment.id,
    })
    expect(await raw.receipt.findFirst({ where: { schoolId, id: receipt.id } })).toMatchObject({
      familyId: targetId,
      number: 1,
    })
    expect(
      await raw.paymentTransaction.findFirst({ where: { schoolId, id: transaction.id } })
    ).toMatchObject({ familyId: targetId })
    expect(
      await raw.invitation.findFirst({ where: { schoolId, id: invitation.id } })
    ).toMatchObject({ familyId: targetId, personId: person.id })
    expect(await raw.student.findFirst({ where: { schoolId, id: student.id } })).not.toBeNull()
  })

  it('sees a child committed by a writer it waited for instead of leaving the child on the archived source', async () => {
    let signalHeld = (_pid: number) => {}
    const held = new Promise<number>((resolve) => {
      signalHeld = resolve
    })
    let releaseWriter = () => {}
    const release = new Promise<void>((resolve) => {
      releaseWriter = resolve
    })
    const writer = raw.$transaction(
      async (tx) => {
        expect(await lockActiveFamily(tx, schoolId, sourceId)).toBe(true)
        const [connection] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`
        signalHeld(connection.pid)
        await release
        return tx.person.create({
          data: {
            schoolId,
            name: 'Concurrent',
            lastname: 'Child',
            families: { create: { familyId: sourceId, relationType: 'OTHER' } },
            student: { create: {} },
          },
        })
      },
      { timeout: 15000 }
    )
    const pid = await held
    const merge = mergeFamilies({ schoolId, sourceId, targetId })
    let observedWait = false
    try {
      for (let attempt = 0; attempt < 200; attempt++) {
        const [state] = await raw.$queryRaw<
          Array<{ waiting: boolean }>
        >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS waiting`
        if (state.waiting) {
          observedWait = true
          break
        }
        await delay(10)
      }
    } finally {
      releaseWriter()
    }
    const [person, outcome] = await Promise.all([writer, merge])
    expect(observedWait).toBe(true)
    expect(outcome).toBe('OK')
    expect(
      await raw.familyPerson.findMany({ where: { schoolId, personId: person.id } })
    ).toMatchObject([{ familyId: targetId }])
    expect(await raw.familyPerson.count({ where: { schoolId, familyId: sourceId } })).toBe(0)
  })
})
