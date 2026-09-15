// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

/**
 * `findStudentIdsEnrolledInPeriod` sur une vraie base : le point de contrôle est que la
 * requête compte les affectations closes, comme `findActiveInPeriod`. Avec un `db` mocké,
 * le test ne vérifierait que la forme du `where` et passerait quelle que soit la sémantique
 * réellement appliquée par Postgres.
 *
 * Fixtures écrites par un client sans garde ni soft-delete, comme `school-isolation.test.ts`.
 */

const databaseUrl = process.env.DATABASE_URL

let raw: PrismaClient
let schoolId: string
let planId: string
let levelId: string
let periodId: string
let otherPeriodId: string
let classPeriodId: string
let otherClassPeriodId: string
let studentId: string

async function createStudent(lastname: string) {
  const person = await raw.person.create({
    data: { schoolId, name: 'Kid', lastname, sex: 'FEMALE' },
  })
  const student = await raw.student.create({
    data: { schoolId, personId: person.id, birthday: new Date('2016-05-05') },
  })
  return student.id
}

async function enroll(
  student: string,
  classPeriod: string,
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  endAt: Date | null
) {
  const enrollment = await raw.enrollment.create({
    data: { schoolId, studentId: student, planId, totalAmount: 100, status },
  })
  await raw.classAssignment.create({
    data: {
      schoolId,
      enrollmentId: enrollment.id,
      classPeriodId: classPeriod,
      startAt: new Date('2026-09-01'),
      endAt,
    },
  })
  return enrollment.id
}

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('findStudentIdsEnrolledInPeriod sur base réelle', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = Date.now().toString(36)

    const school = await raw.school.create({
      data: { name: `gw ${suffix}`, slug: `gw-${suffix}` },
    })
    schoolId = school.id
    const [plan, level, period, otherPeriod] = await Promise.all([
      raw.plan.create({ data: { schoolId, name: 'Plein', amount: 100 } }),
      raw.level.create({ data: { schoolId, name: 'CP' } }),
      raw.period.create({
        data: {
          schoolId,
          name: '2026-2027',
          startAt: new Date('2026-09-01'),
          endAt: new Date('2027-06-30'),
        },
      }),
      raw.period.create({
        data: {
          schoolId,
          name: '2027-2028',
          startAt: new Date('2027-09-01'),
          endAt: new Date('2028-06-30'),
        },
      }),
    ])
    planId = plan.id
    levelId = level.id
    periodId = period.id
    otherPeriodId = otherPeriod.id

    const [classPeriod, otherClassPeriod] = await Promise.all([
      raw.classPeriod.create({
        data: { schoolId, name: 'CP-A', levelId, periodId, capacity: 20 },
      }),
      raw.classPeriod.create({
        data: { schoolId, name: 'CP-B', levelId, periodId: otherPeriodId, capacity: 20 },
      }),
    ])
    classPeriodId = classPeriod.id
    otherClassPeriodId = otherClassPeriod.id

    studentId = await createStudent('Live')
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    await raw.classAssignment.deleteMany({ where: { schoolId } })
    await raw.enrollment.deleteMany({ where: { schoolId } })
    await raw.classPeriod.deleteMany({ where: { schoolId } })
    await raw.period.deleteMany({ where: { schoolId } })
    await raw.level.deleteMany({ where: { schoolId } })
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.student.deleteMany({ where: { schoolId } })
    await raw.person.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.$disconnect()
  }, 60_000)

  it('compte une affectation close, comme findActiveInPeriod', async () => {
    // GIVEN une inscription vivante réaffectée vers une autre période : l'affectation de la
    // période d'origine est close, l'inscription reste ACTIVE.
    const student = await createStudent('Reassigned')
    await enroll(student, classPeriodId, 'ACTIVE', new Date('2026-11-30'))

    // WHEN
    const enrolled = await enrollmentGateway.findStudentIdsEnrolledInPeriod(
      schoolId,
      [student],
      periodId
    )

    // THEN la période ne doit pas paraître libre : `createEnrollment` refuserait avec
    // `duplicateEnrollment`, et un remplacement annulerait une inscription vivante.
    expect(enrolled.has(student)).toBe(true)
    expect(
      await enrollmentGateway.findActiveInPeriod(schoolId, student, classPeriodId)
    ).not.toBeNull()
  })

  it.each([
    ['PENDING', true],
    ['ACTIVE', true],
    ['COMPLETED', false],
    ['CANCELLED', false],
  ] as const)('rend %s -> %s', async (status, expected) => {
    // GIVEN
    const student = await createStudent(`status-${status}`)
    await enroll(student, classPeriodId, status, null)

    // WHEN
    const enrolled = await enrollmentGateway.findStudentIdsEnrolledInPeriod(
      schoolId,
      [student],
      periodId
    )

    // THEN une inscription terminée ou annulée laisse la réinscription ouverte.
    expect(enrolled.has(student)).toBe(expected)
  })

  it("ignore l'inscription vivante d'une autre période", async () => {
    // GIVEN
    const student = await createStudent('OtherPeriod')
    await enroll(student, otherClassPeriodId, 'ACTIVE', null)

    // WHEN
    const enrolled = await enrollmentGateway.findStudentIdsEnrolledInPeriod(
      schoolId,
      [student],
      periodId
    )

    // THEN
    expect(enrolled.has(student)).toBe(false)
  })

  it("ne rend pas l'élève d'une autre école", async () => {
    // GIVEN
    await enroll(studentId, classPeriodId, 'ACTIVE', null)

    // WHEN
    const enrolled = await enrollmentGateway.findStudentIdsEnrolledInPeriod(
      'school-inexistante',
      [studentId],
      periodId
    )

    // THEN
    expect(enrolled.has(studentId)).toBe(false)
  })
})
