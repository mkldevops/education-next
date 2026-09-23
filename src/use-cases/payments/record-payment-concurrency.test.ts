// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient, db } from '@/lib/db'
import { recordPayment } from './record-payment'

const databaseUrl = process.env.DATABASE_URL
const paymentsEnabled = {
  get: async () => ({ value: 'true' }),
} as unknown as typeof configGateway

let raw: PrismaClient
let schoolId: string
let otherSchoolId: string
let familyId: string
let enrollmentId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('recordPayment concurrency', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-pay-lock`
    const [school, otherSchool] = await Promise.all([
      raw.school.create({ data: { name: `pay lock ${suffix}`, slug: `pay-lock-${suffix}` } }),
      raw.school.create({ data: { name: `pay other ${suffix}`, slug: `pay-other-${suffix}` } }),
    ])
    schoolId = school.id
    otherSchoolId = otherSchool.id

    const admin = await raw.user.create({ data: { email: `admin-${suffix}@payment.test` } })
    const plan = await raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 720 } })
    const family = await raw.family.create({
      data: { schoolId, name: 'Famille Concurrente', createdById: admin.id },
    })
    familyId = family.id
    const person = await raw.person.create({
      data: { schoolId, name: 'Inès', lastname: 'Concurrente' },
    })
    await raw.familyPerson.create({
      data: { schoolId, familyId, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    const enrollment = await raw.enrollment.create({
      data: {
        schoolId,
        studentId: student.id,
        planId: plan.id,
        totalAmount: 720,
        status: 'ACTIVE',
      },
    })
    enrollmentId = enrollment.id
  }, 60_000)

  beforeEach(async () => {
    await raw.payment.deleteMany({ where: { schoolId } })
  })

  afterAll(async () => {
    if (!raw) return
    await raw.payment.deleteMany({ where: { schoolId } })
    await raw.enrollment.deleteMany({ where: { schoolId } })
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.student.deleteMany({ where: { schoolId } })
    await raw.familyPerson.deleteMany({ where: { schoolId } })
    await raw.person.deleteMany({ where: { schoolId } })
    await raw.family.deleteMany({ where: { schoolId } })
    await raw.user.deleteMany({ where: { email: { endsWith: '-pay-lock@payment.test' } } })
    await raw.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } })
    await raw.$disconnect()
  }, 60_000)

  it('accepts only one of two simultaneous payments of the whole balance', async () => {
    const payment = {
      schoolId,
      familyId,
      amount: 720,
      method: 'CASH' as const,
      paidAt: new Date('2026-09-15'),
    }

    const results = await Promise.all([
      recordPayment(payment, paymentsEnabled),
      recordPayment(payment, paymentsEnabled),
    ])

    expect([...results].sort()).toEqual(['OK', 'overpayment'])
    const banked = await raw.payment.aggregate({
      where: { schoolId, enrollmentId, isActive: true },
      _sum: { amount: true },
    })
    expect(Number(banked._sum.amount)).toBe(720)
  })

  it('never locks a family through another school', async () => {
    const locked = await db.$transaction((tx) =>
      paymentGateway.lockFamilyForPayment(tx, otherSchoolId, familyId)
    )

    expect(locked).toBe(false)
    expect(
      await recordPayment(
        {
          schoolId: otherSchoolId,
          familyId,
          amount: 10,
          method: 'CASH',
          paidAt: new Date('2026-09-15'),
        },
        paymentsEnabled
      )
    ).toBe('notFound')
  })
})
