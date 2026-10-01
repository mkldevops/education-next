// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { PAYMENTS_ENABLED_CONFIG_KEY } from '@/lib/payment-config'
import { recordPayment } from '@/use-cases/payments/record-payment'
import { applyDiscount } from './apply-discount'
import { setEnrollmentPlan } from './set-enrollment-plan'

const databaseUrl = process.env.DATABASE_URL
const paymentsEnabled = {
  get: async () => ({ value: 'true' }),
} as unknown as typeof configGateway

let raw: PrismaClient
let schoolId: string
let familyId: string
let planId: string
let cheaperPlanId: string
let enrollmentId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

/**
 * Scénario de #425 : total 100 €, payé 0 €. Un total ramené à 50 € et un encaissement de
 * 100 € lancés ensemble ne doivent jamais laisser 100 € payés pour 50 € dus. Le verrou de
 * la famille impose un ordre : celui qui passe en second relit ce que le premier a écrit.
 */
describe.skipIf(!databaseUrl)('enrollment pricing vs payment concurrency', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-price-lock`
    const school = await raw.school.create({
      data: { name: `price lock ${suffix}`, slug: `price-lock-${suffix}` },
    })
    schoolId = school.id
    await raw.config.create({
      data: { schoolId, name: PAYMENTS_ENABLED_CONFIG_KEY, value: 'true', valueType: 'BOOLEAN' },
    })

    const admin = await raw.user.create({ data: { email: `admin-${suffix}@pricing.test` } })
    const [plan, cheaperPlan] = await Promise.all([
      raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 100 } }),
      raw.plan.create({ data: { schoolId, name: `cheaper ${suffix}`, amount: 50 } }),
    ])
    planId = plan.id
    cheaperPlanId = cheaperPlan.id
    const family = await raw.family.create({
      data: { schoolId, name: 'Famille Tarifée', createdById: admin.id },
    })
    familyId = family.id
    const person = await raw.person.create({
      data: { schoolId, name: 'Yanis', lastname: 'Tarifé' },
    })
    await raw.familyPerson.create({
      data: { schoolId, familyId, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    const enrollment = await raw.enrollment.create({
      data: { schoolId, studentId: student.id, planId, totalAmount: 100, status: 'ACTIVE' },
    })
    enrollmentId = enrollment.id
  }, 60_000)

  beforeEach(async () => {
    await raw.payment.deleteMany({ where: { schoolId } })
    await raw.enrollment.update({
      where: { id_schoolId: { id: enrollmentId, schoolId } },
      data: { planId, discount: 0, totalAmount: 100 },
    })
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
    await raw.config.deleteMany({ where: { schoolId } })
    await raw.user.deleteMany({ where: { email: { endsWith: '-price-lock@pricing.test' } } })
    await raw.school.deleteMany({ where: { id: schoolId } })
    await raw.$disconnect()
  }, 60_000)

  async function bankedVersusDue() {
    const [banked, enrollment] = await Promise.all([
      raw.payment.aggregate({
        where: { schoolId, enrollmentId, isActive: true },
        _sum: { amount: true },
      }),
      raw.enrollment.findUniqueOrThrow({
        where: { id_schoolId: { id: enrollmentId, schoolId } },
        select: { totalAmount: true },
      }),
    ])
    return { paid: Number(banked._sum.amount ?? 0), total: Number(enrollment.totalAmount) }
  }

  const payment = () =>
    recordPayment(
      { schoolId, familyId, amount: 100, method: 'CASH', paidAt: new Date('2026-09-15') },
      paymentsEnabled
    )

  it('never leaves a discount below what a simultaneous payment banked', async () => {
    const [discounted, paid] = await Promise.all([
      applyDiscount({ schoolId, enrollmentId, totalAmount: 50 }, paymentsEnabled),
      payment(),
    ])

    // Remise d'abord : le règlement relit un reste de 50 € et refuse 100 €. Règlement
    // d'abord : la remise relit 100 € encaissés et refuse un total de 50 €.
    expect([discounted, paid]).toSatisfy(
      (results: unknown[]) =>
        JSON.stringify(results) === JSON.stringify(['OK', 'overpayment']) ||
        JSON.stringify(results) === JSON.stringify(['totalBelowPaid', 'OK'])
    )
    const { paid: banked, total } = await bankedVersusDue()
    expect(banked).toBeLessThanOrEqual(total)
  })

  it('never leaves a cheaper plan below what a simultaneous payment banked', async () => {
    const [repriced, paid] = await Promise.all([
      setEnrollmentPlan({ schoolId, enrollmentId, planId: cheaperPlanId }),
      payment(),
    ])

    expect([repriced, paid]).toSatisfy(
      (results: unknown[]) =>
        JSON.stringify(results) === JSON.stringify(['OK', 'overpayment']) ||
        JSON.stringify(results) === JSON.stringify(['totalBelowPaid', 'OK'])
    )
    const { paid: banked, total } = await bankedVersusDue()
    expect(banked).toBeLessThanOrEqual(total)
  })
})
