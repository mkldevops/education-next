// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { getOverdueStudents } from '@/use-cases/payments/overdue-students'
import { getPaymentTrackingByFamily } from '@/use-cases/payments/payment-tracking'
import { archiveStudent, previewStudentArchive } from './archive-student'

const databaseUrl = process.env.DATABASE_URL
const NOW = new Date('2027-03-15T10:00:00.000Z')
const noMeals = async () => {}

let raw: PrismaClient
let schoolId: string
let otherSchoolId: string
let adminId: string
let planId: string
let classPeriodId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

/**
 * Départ d'un élève : 1 000 € en 10 mensualités de 100 € (septembre à juin). Parti après
 * décembre, il doit 400 € ; l'arriéré reste suivi, les mois suivants ne sont plus dus.
 */
describe.skipIf(!databaseUrl)('archiveStudent', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-departure`
    const [school, otherSchool] = await Promise.all([
      raw.school.create({ data: { name: `departure ${suffix}`, slug: `departure-${suffix}` } }),
      raw.school.create({ data: { name: `other ${suffix}`, slug: `other-${suffix}` } }),
    ])
    schoolId = school.id
    otherSchoolId = otherSchool.id
    adminId = (await raw.user.create({ data: { email: `admin-${suffix}@departure.test` } })).id
    planId = (
      await raw.plan.create({
        data: {
          schoolId,
          name: `plan ${suffix}`,
          amount: 1000,
          paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 },
        },
      })
    ).id
    const period = await raw.period.create({
      data: {
        schoolId,
        name: '2026-2027',
        startAt: new Date('2026-09-01T00:00:00.000Z'),
        endAt: new Date('2027-06-30T00:00:00.000Z'),
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

  async function seedStudent(paid: number) {
    const family = await raw.family.create({
      data: { schoolId, name: `Famille ${paid}`, createdById: adminId },
    })
    const person = await raw.person.create({ data: { schoolId, name: 'Yanis', lastname: 'Parti' } })
    await raw.familyPerson.create({
      data: { schoolId, familyId: family.id, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    const enrollment = await raw.enrollment.create({
      data: { schoolId, studentId: student.id, planId, totalAmount: 1000, status: 'ACTIVE' },
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
          paidAt: new Date('2026-09-10T00:00:00.000Z'),
        },
      })
    }
    return { studentId: student.id, enrollmentId: enrollment.id, familyId: family.id }
  }

  const readEnrollment = (id: string) =>
    raw.enrollment.findUniqueOrThrow({ where: { id_schoolId: { id, schoolId } } })

  it('previews what stays owed through the chosen month', async () => {
    const { studentId } = await seedStudent(150)

    const preview = await previewStudentArchive({ schoolId, studentId, endMonth: '2026-12' })

    expect(preview).toMatchObject({
      endMonth: '2026-12',
      owed: 400,
      paid: 150,
      remaining: 250,
      prorated: true,
    })
    expect(typeof preview === 'object' && preview.months.at(0)).toBe('2026-09')
    expect(typeof preview === 'object' && preview.months.at(-1)).toBe('2027-06')
  })

  it('keeps the arrears owed, closes the enrollment and leaves the class', async () => {
    const { studentId, enrollmentId, familyId } = await seedStudent(150)

    expect(await archiveStudent({ schoolId, studentId, endMonth: '2026-12' }, noMeals, NOW)).toBe(
      'OK'
    )

    const enrollment = await readEnrollment(enrollmentId)
    expect(enrollment.status).toBe('COMPLETED')
    expect(enrollment.endMonth?.toISOString().slice(0, 7)).toBe('2026-12')
    expect(Number(enrollment.totalAmount)).toBe(400)
    expect(enrollment.writeOffAmount).toBeNull()
    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId } },
    })
    expect(student.isActive).toBe(false)
    expect(student.leftAt).toEqual(NOW)
    expect(
      await raw.classAssignment.count({ where: { schoolId, enrollmentId, endAt: null } })
    ).toBe(0)

    const tracking = await getPaymentTrackingByFamily(schoolId, { familyId, reference: NOW })
    expect(tracking).toEqual([
      expect.objectContaining({ familyId, expectedToDate: 400, overdueAmount: 250 }),
    ])

    const overdue = await getOverdueStudents(schoolId, { reference: NOW })
    expect(overdue.find((row) => row.studentId === studentId)).toMatchObject({
      archived: true,
      family: { id: familyId, overdueAmount: 250 },
    })
  })

  it('writes the remainder off with its reason', async () => {
    const { studentId, enrollmentId, familyId } = await seedStudent(150)

    expect(
      await archiveStudent(
        { schoolId, studentId, endMonth: '2026-12', remainder: 'writeOff', reason: 'Déménagement' },
        noMeals,
        NOW
      )
    ).toBe('OK')

    const enrollment = await readEnrollment(enrollmentId)
    expect(Number(enrollment.totalAmount)).toBe(150)
    expect(Number(enrollment.writeOffAmount)).toBe(250)
    expect(enrollment.writeOffReason).toBe('Déménagement')
    const [tracking] = await getPaymentTrackingByFamily(schoolId, { familyId, reference: NOW })
    expect(tracking.overdueAmount).toBe(0)
  })

  it('requires a reason to write the remainder off', async () => {
    const { studentId } = await seedStudent(0)

    expect(
      await archiveStudent(
        { schoolId, studentId, endMonth: '2026-12', remainder: 'writeOff', reason: '  ' },
        noMeals,
        NOW
      )
    ).toBe('reasonRequired')
    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId } },
    })
    expect(student.isActive).toBe(true)
  })

  it('never turns a payment beyond the new total into a credit', async () => {
    const { studentId, enrollmentId } = await seedStudent(500)

    expect(
      await archiveStudent(
        { schoolId, studentId, endMonth: '2026-12', remainder: 'writeOff', reason: 'Départ' },
        noMeals,
        NOW
      )
    ).toBe('OK')

    const enrollment = await readEnrollment(enrollmentId)
    expect(Number(enrollment.totalAmount)).toBe(500)
    expect(Number(enrollment.writeOffAmount)).toBe(0)
  })

  it('refuses a month outside the enrollment period without archiving', async () => {
    const { studentId } = await seedStudent(0)

    expect(await archiveStudent({ schoolId, studentId, endMonth: '2027-09' }, noMeals, NOW)).toBe(
      'endMonthOutsidePeriod'
    )
    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId } },
    })
    expect(student.isActive).toBe(true)
  })

  it('cannot archive a student of another school', async () => {
    const { studentId, enrollmentId } = await seedStudent(0)

    expect(
      await archiveStudent(
        { schoolId: otherSchoolId, studentId, endMonth: '2026-12' },
        noMeals,
        NOW
      )
    ).toBe('notFound')
    expect(await previewStudentArchive({ schoolId: otherSchoolId, studentId })).toBe('notFound')

    const enrollment = await readEnrollment(enrollmentId)
    expect(enrollment.status).toBe('ACTIVE')
    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId } },
    })
    expect(student.isActive).toBe(true)
  })
})
