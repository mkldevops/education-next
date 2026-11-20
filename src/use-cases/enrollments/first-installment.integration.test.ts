// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { getPaymentTrackingByFamily } from '@/use-cases/payments/payment-tracking'
import { previewStudentArchive } from '@/use-cases/students/archive-student'
import { setEnrollmentPlan } from './set-enrollment-plan'
import { setEnrollmentStartMonth } from './set-enrollment-start-month'

const databaseUrl = process.env.DATABASE_URL
const END_OF_NOVEMBER = new Date('2026-12-01T10:00:00.000Z')

let raw: PrismaClient
let schoolId: string
let otherSchoolId: string
let adminId: string
let planId: string
let otherPlanId: string
let classPeriodId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

/**
 * Arrivée en cours d'année : 100 000 en 10 mensualités de 10 000 (fin octobre à fin juillet).
 * Le premier mois dû peut être réduit ; le total reste la somme des échéances dues.
 */
describe.skipIf(!databaseUrl)('reduced first installment of an arrival during the year', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-arrival`
    const [school, otherSchool] = await Promise.all([
      raw.school.create({ data: { name: `arrival ${suffix}`, slug: `arrival-${suffix}` } }),
      raw.school.create({ data: { name: `other ${suffix}`, slug: `other-${suffix}` } }),
    ])
    schoolId = school.id
    otherSchoolId = otherSchool.id
    adminId = (await raw.user.create({ data: { email: `admin-${suffix}@arrival.test` } })).id
    const paymentSchedule = { mode: 'MONTHLY', firstMonth: 10, count: 10, dueDay: 31 }
    const [plan, otherPlan] = await Promise.all([
      raw.plan.create({
        data: { schoolId, name: `plan ${suffix}`, amount: 100_000, paymentSchedule },
      }),
      raw.plan.create({
        data: { schoolId, name: `plan plus ${suffix}`, amount: 120_000, paymentSchedule },
      }),
    ])
    planId = plan.id
    otherPlanId = otherPlan.id
    const period = await raw.period.create({
      data: {
        schoolId,
        name: '2026-2027',
        startAt: new Date('2026-09-01T00:00:00.000Z'),
        endAt: new Date('2027-07-31T00:00:00.000Z'),
      },
    })
    const level = await raw.level.create({ data: { schoolId, name: 'CP' } })
    classPeriodId = (
      await raw.classPeriod.create({
        data: { schoolId, name: 'CP A', capacity: 20, levelId: level.id, periodId: period.id },
      })
    ).id
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    for (const id of [schoolId, otherSchoolId]) {
      if (!id) continue
      await raw.payment.deleteMany({ where: { schoolId: id } })
      await raw.classAssignment.deleteMany({ where: { schoolId: id } })
      await raw.enrollment.deleteMany({ where: { schoolId: id } })
      await raw.classPeriod.deleteMany({ where: { schoolId: id } })
      await raw.level.deleteMany({ where: { schoolId: id } })
      await raw.period.deleteMany({ where: { schoolId: id } })
      await raw.plan.deleteMany({ where: { schoolId: id } })
      await raw.student.deleteMany({ where: { schoolId: id } })
      await raw.familyPerson.deleteMany({ where: { schoolId: id } })
      await raw.person.deleteMany({ where: { schoolId: id } })
      await raw.family.deleteMany({ where: { schoolId: id } })
      await raw.school.deleteMany({ where: { id } })
    }
    if (adminId) await raw.user.delete({ where: { id: adminId } })
    await raw.$disconnect()
  }, 60_000)

  async function seedStudent(name: string, paid: number) {
    const family = await raw.family.create({
      data: { schoolId, name: `Famille ${name}`, createdById: adminId },
    })
    const person = await raw.person.create({ data: { schoolId, name, lastname: 'Arrivé' } })
    await raw.familyPerson.create({
      data: { schoolId, familyId: family.id, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    const enrollment = await raw.enrollment.create({
      data: { schoolId, studentId: student.id, planId, totalAmount: 100_000, status: 'ACTIVE' },
    })
    await raw.classAssignment.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classPeriodId,
        startAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    })
    if (paid > 0) {
      await raw.payment.create({
        data: {
          schoolId,
          familyId: family.id,
          enrollmentId: enrollment.id,
          amount: paid,
          method: 'CASH',
          paidAt: new Date('2026-11-10T00:00:00.000Z'),
        },
      })
    }
    return { studentId: student.id, enrollmentId: enrollment.id, familyId: family.id }
  }

  const readEnrollment = async (id: string) => {
    const row = await raw.enrollment.findUniqueOrThrow({ where: { id_schoolId: { id, schoolId } } })
    return {
      planId: row.planId,
      startMonth: row.startMonth?.toISOString().slice(0, 7) ?? null,
      firstInstallmentAmount:
        row.firstInstallmentAmount === null ? null : Number(row.firstInstallmentAmount),
      discount: Number(row.discount),
      totalAmount: Number(row.totalAmount),
    }
  }

  const dueAtEndOfNovember = async (familyId: string) => {
    const [tracking] = await getPaymentTrackingByFamily(schoolId, {
      familyId,
      reference: END_OF_NOVEMBER,
    })
    return { expectedToDate: tracking.expectedToDate, overdueAmount: tracking.overdueAmount }
  }

  it('owes half of October then the full months to a student who joined mid-October', async () => {
    const { enrollmentId, familyId } = await seedStudent('Mi-octobre', 12_500)

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 5_000,
      })
    ).toBe('OK')

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      startMonth: '2026-10',
      firstInstallmentAmount: 5_000,
      totalAmount: 95_000,
    })
    expect(await dueAtEndOfNovember(familyId)).toEqual({
      expectedToDate: 15_000,
      overdueAmount: 2_500,
    })
  })

  it('owes a quarter of October to a student back at the end of the month', async () => {
    const { enrollmentId, familyId } = await seedStudent('Fin-octobre', 10_000)

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 2_500,
      })
    ).toBe('OK')

    expect((await readEnrollment(enrollmentId)).totalAmount).toBe(92_500)
    expect(await dueAtEndOfNovember(familyId)).toEqual({
      expectedToDate: 12_500,
      overdueAmount: 2_500,
    })
  })

  it('owes nothing before December to a student who arrived mid-December', async () => {
    const { enrollmentId, familyId } = await seedStudent('Mi-décembre', 0)

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-12',
        firstInstallmentAmount: 5_000,
      })
    ).toBe('OK')

    expect((await readEnrollment(enrollmentId)).totalAmount).toBe(75_000)
    expect(await dueAtEndOfNovember(familyId)).toEqual({ expectedToDate: 0, overdueAmount: 0 })
    const [january] = await getPaymentTrackingByFamily(schoolId, {
      familyId,
      reference: new Date('2027-01-15T10:00:00.000Z'),
    })
    expect(january.expectedToDate).toBe(5_000)
  })

  it('keeps the reduced first month in what a departure leaves owed', async () => {
    const { enrollmentId, studentId } = await seedStudent('Parti', 0)
    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-10',
      firstInstallmentAmount: 5_000,
    })

    expect(await previewStudentArchive({ schoolId, studentId, endMonth: '2026-12' })).toMatchObject(
      { owed: 25_000, prorated: true }
    )
  })

  it('clears the amount when the start month moves without it', async () => {
    const { enrollmentId } = await seedStudent('Décalé', 0)
    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-10',
      firstInstallmentAmount: 5_000,
    })

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-11' })).toBe(
      'OK'
    )

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      startMonth: '2026-11',
      firstInstallmentAmount: null,
      totalAmount: 90_000,
    })
  })

  it('clears the amount when the plan changes, the start month following', async () => {
    const { enrollmentId } = await seedStudent('Reformulé', 0)
    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-11',
      firstInstallmentAmount: 5_000,
    })

    expect(await setEnrollmentPlan({ schoolId, enrollmentId, planId: otherPlanId })).toBe('OK')

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      planId: otherPlanId,
      startMonth: '2026-11',
      firstInstallmentAmount: null,
      totalAmount: 108_000,
    })
  })

  it('removes the discount in the same write when asked to', async () => {
    const { enrollmentId } = await seedStudent('Remisé', 0)
    await raw.enrollment.update({
      where: { id_schoolId: { id: enrollmentId, schoolId } },
      data: { discount: 20_000, totalAmount: 80_000 },
    })

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 5_000,
        removeDiscount: true,
      })
    ).toBe('OK')

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      discount: 0,
      firstInstallmentAmount: 5_000,
      totalAmount: 95_000,
    })
  })

  it('refuses a total the payments already exceed, leaving the enrollment untouched', async () => {
    const { enrollmentId } = await seedStudent('Trop-payé', 96_000)

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 5_000,
      })
    ).toBe('totalBelowPaid')

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      startMonth: null,
      firstInstallmentAmount: null,
      totalAmount: 100_000,
    })
  })

  it('never writes the enrollment of another school', async () => {
    const { enrollmentId } = await seedStudent('Voisin', 0)

    expect(
      await setEnrollmentStartMonth({
        schoolId: otherSchoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 5_000,
      })
    ).toBe('notFound')

    expect(await readEnrollment(enrollmentId)).toMatchObject({
      startMonth: null,
      firstInstallmentAmount: null,
      totalAmount: 100_000,
    })
  })
})
