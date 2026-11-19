// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { countFormerStudents, listFormerStudents } from './former-students'
import { reinstateStudent } from './reinstate-student'

const databaseUrl = process.env.DATABASE_URL

let raw: PrismaClient
let schoolId: string
let otherSchoolId: string
let adminId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

/** « Anciens élèves » : la liste des élèves archivés et leur réintégration. */
describe.skipIf(!databaseUrl)('former students', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-former`
    const [school, otherSchool] = await Promise.all([
      raw.school.create({ data: { name: `former ${suffix}`, slug: `former-${suffix}` } }),
      raw.school.create({ data: { name: `other ${suffix}`, slug: `other-${suffix}` } }),
    ])
    schoolId = school.id
    otherSchoolId = otherSchool.id
    adminId = (await raw.user.create({ data: { email: `admin-${suffix}@former.test` } })).id
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

  /** A student of `school` who left after December, owing 400 € with `paid` already paid. */
  async function seedFormer(school: string, lastname: string, paid: number, leftAt: Date | null) {
    const family = await raw.family.create({
      data: { schoolId: school, name: `Famille ${lastname}`, createdById: adminId },
    })
    const person = await raw.person.create({ data: { schoolId: school, name: 'Inès', lastname } })
    await raw.familyPerson.create({
      data: { schoolId: school, familyId: family.id, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({
      data: { schoolId: school, personId: person.id, isActive: false, leftAt },
    })
    const plan = await raw.plan.create({
      data: { schoolId: school, name: `plan ${lastname}`, amount: 1000 },
    })
    const period = await raw.period.create({
      data: {
        schoolId: school,
        name: `2026-2027 ${lastname}`,
        startAt: new Date('2026-09-01T00:00:00.000Z'),
        endAt: new Date('2027-06-30T00:00:00.000Z'),
      },
    })
    const level = await raw.level.create({ data: { schoolId: school, name: `CE1 ${lastname}` } })
    const classPeriod = await raw.classPeriod.create({
      data: {
        schoolId: school,
        name: 'CE1 B',
        capacity: 20,
        levelId: level.id,
        periodId: period.id,
      },
    })
    const enrollment = await raw.enrollment.create({
      data: {
        schoolId: school,
        studentId: student.id,
        planId: plan.id,
        totalAmount: 400,
        status: 'COMPLETED',
        endMonth: new Date('2026-12-01T00:00:00.000Z'),
      },
    })
    await raw.classAssignment.create({
      data: {
        schoolId: school,
        enrollmentId: enrollment.id,
        classPeriodId: classPeriod.id,
        startAt: new Date('2026-09-01T00:00:00.000Z'),
        endAt: new Date('2027-01-10T00:00:00.000Z'),
      },
    })
    if (paid > 0) {
      await raw.payment.create({
        data: {
          schoolId: school,
          familyId: family.id,
          enrollmentId: enrollment.id,
          amount: paid,
          method: 'CASH',
          paidAt: new Date('2026-09-10T00:00:00.000Z'),
        },
      })
    }
    return { studentId: student.id, familyId: family.id }
  }

  it('lists the archived students of the school only, with what they still owe', async () => {
    const leftAt = new Date('2027-01-10T09:00:00.000Z')
    const owing = await seedFormer(schoolId, 'Doit', 150, leftAt)
    const settled = await seedFormer(schoolId, 'Solde', 400, null)
    const elsewhere = await seedFormer(otherSchoolId, 'Ailleurs', 0, leftAt)

    const rows = await listFormerStudents(schoolId)

    expect(rows.map((row) => row.id).sort()).toEqual([owing.studentId, settled.studentId].sort())
    expect(rows.find((row) => row.id === owing.studentId)).toEqual({
      id: owing.studentId,
      name: 'Inès Doit',
      family: { id: owing.familyId, name: 'Famille Doit' },
      lastClass: { name: 'CE1 B', period: '2026-2027 Doit' },
      leftAt,
      remaining: 250,
    })
    // Archived before `leftAt` existed: the last month owed stands in for the departure.
    expect(rows.find((row) => row.id === settled.studentId)).toMatchObject({
      leftAt: new Date('2026-12-01T00:00:00.000Z'),
      remaining: 0,
    })
    expect(rows.some((row) => row.id === elsewhere.studentId)).toBe(false)
    expect(await countFormerStudents(schoolId)).toBe(2)
  })

  it('stops an enrollment left open by an older archive at the departure month', async () => {
    const { studentId } = await seedFormer(
      schoolId,
      'Ancien',
      150,
      new Date('2026-10-20T09:00:00.000Z')
    )
    // Archived before `archiveStudent`: the enrollment stayed ACTIVE, uncut, without end month.
    const enrollment = await raw.enrollment.findFirstOrThrow({ where: { schoolId, studentId } })
    await raw.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'ACTIVE', endMonth: null, totalAmount: 1000 },
    })
    await raw.plan.update({
      where: { id_schoolId: { id: enrollment.planId, schoolId } },
      data: { paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 10 } },
    })

    const row = (await listFormerStudents(schoolId)).find((item) => item.id === studentId)

    // September and October owed (200), 150 paid: 50, not the 850 left on the whole year.
    expect(row?.remaining).toBe(50)
  })

  it('reinstates an archived student and keeps its enrollments closed', async () => {
    const { studentId } = await seedFormer(schoolId, 'Retour', 0, new Date())

    expect(await reinstateStudent({ schoolId, studentId })).toBe('OK')

    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId } },
      include: { enrollments: true },
    })
    expect(student.isActive).toBe(true)
    expect(student.leftAt).toBeNull()
    expect(student.enrollments.map((enrollment) => enrollment.status)).toEqual(['COMPLETED'])
    expect((await listFormerStudents(schoolId)).some((row) => row.id === studentId)).toBe(false)
    // Already active: nothing left to reinstate.
    expect(await reinstateStudent({ schoolId, studentId })).toBe('notFound')
  })

  it('refuses to reinstate a student of another school', async () => {
    const { studentId } = await seedFormer(otherSchoolId, 'Etranger', 0, new Date())

    expect(await reinstateStudent({ schoolId, studentId })).toBe('notFound')

    const student = await raw.student.findUniqueOrThrow({
      where: { id_schoolId: { id: studentId, schoolId: otherSchoolId } },
    })
    expect(student.isActive).toBe(false)
  })
})
