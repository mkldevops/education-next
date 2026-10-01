// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { createEnrollment } from '@/use-cases/enrollments/create-enrollment'
import { promoteStudents } from '@/use-cases/enrollments/promote-students'
import { reassignClass } from '@/use-cases/enrollments/reassign-class'

/**
 * Invariants d'inscription sur une vraie base, là où les mocks ne prouvent rien : une classe ne
 * dépasse jamais sa capacité et un élève n'a qu'une inscription en cours par période, même quand
 * deux écritures partent en même temps. Chaque test a sa propre école : `promoteStudents` balaie
 * toute l'école, un élève d'un autre test fausserait les totaux.
 */

const databaseUrl = process.env.DATABASE_URL

let raw: PrismaClient
const schoolIds: string[] = []

async function createSchool({ targetCapacity = 20 }: { targetCapacity?: number } = {}) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const school = await raw.school.create({
    data: { name: `integrity ${suffix}`, slug: `integrity-${suffix}` },
  })
  const schoolId = school.id
  schoolIds.push(schoolId)

  const plan = await raw.plan.create({ data: { schoolId, name: 'Plein', amount: 100 } })
  const level3 = await raw.level.create({ data: { schoolId, name: 'CE2' } })
  const level2 = await raw.level.create({
    data: { schoolId, name: 'CE1', nextLevelId: level3.id },
  })
  const level1 = await raw.level.create({
    data: { schoolId, name: 'CP', nextLevelId: level2.id },
  })
  const [source, target] = await Promise.all([
    raw.period.create({
      data: {
        schoolId,
        name: '2025-2026',
        startAt: new Date('2025-09-01'),
        endAt: new Date('2026-06-30'),
      },
    }),
    raw.period.create({
      data: {
        schoolId,
        name: '2026-2027',
        startAt: new Date('2026-09-01'),
        endAt: new Date('2027-06-30'),
      },
    }),
  ])
  const [sourceL1, sourceL2, targetL2, targetL3] = await Promise.all([
    raw.classPeriod.create({
      data: { schoolId, name: 'CP-A', levelId: level1.id, periodId: source.id, capacity: 20 },
    }),
    raw.classPeriod.create({
      data: { schoolId, name: 'CE1-A', levelId: level2.id, periodId: source.id, capacity: 20 },
    }),
    raw.classPeriod.create({
      data: {
        schoolId,
        name: 'CE1-B',
        levelId: level2.id,
        periodId: target.id,
        capacity: targetCapacity,
      },
    }),
    raw.classPeriod.create({
      data: { schoolId, name: 'CE2-B', levelId: level3.id, periodId: target.id, capacity: 20 },
    }),
  ])

  async function createStudent(lastname: string, isActive = true) {
    const person = await raw.person.create({
      data: { schoolId, name: 'Kid', lastname, sex: 'FEMALE' },
    })
    const student = await raw.student.create({
      data: { schoolId, personId: person.id, birthday: new Date('2018-05-05'), isActive },
    })
    return student.id
  }

  async function enroll(
    studentId: string,
    assignments: Array<{ classPeriodId: string; endAt: Date | null }>,
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' = 'COMPLETED'
  ) {
    const enrollment = await raw.enrollment.create({
      data: { schoolId, studentId, planId: plan.id, totalAmount: 100, status },
    })
    for (const [index, assignment] of assignments.entries()) {
      await raw.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classPeriodId: assignment.classPeriodId,
          startAt: new Date(Date.UTC(2025, 8, 1 + index)),
          endAt: assignment.endAt,
        },
      })
    }
    return enrollment.id
  }

  const openInTarget = (studentId: string) =>
    raw.enrollment.count({
      where: {
        schoolId,
        studentId,
        status: { in: ['PENDING', 'ACTIVE'] },
        classAssignments: { some: { endAt: null, classPeriod: { periodId: target.id } } },
      },
    })

  const seatsTaken = (classPeriodId: string) =>
    raw.classAssignment.count({ where: { schoolId, classPeriodId, endAt: null } })

  return {
    schoolId,
    planId: plan.id,
    source,
    target,
    classes: { sourceL1, sourceL2, targetL2, targetL3 },
    createStudent,
    enroll,
    openInTarget,
    seatsTaken,
    promotion: { schoolId, sourcePeriodId: source.id, targetPeriodId: target.id },
  }
}

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('intégrité des inscriptions sur base réelle', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })

  afterAll(async () => {
    if (!raw) return
    for (const schoolId of schoolIds) {
      await raw.classAssignment.deleteMany({ where: { schoolId } })
      await raw.enrollment.deleteMany({ where: { schoolId } })
      await raw.classPeriod.deleteMany({ where: { schoolId } })
      await raw.period.deleteMany({ where: { schoolId } })
      await raw.level.updateMany({ where: { schoolId }, data: { nextLevelId: null } })
      await raw.level.deleteMany({ where: { schoolId } })
      await raw.plan.deleteMany({ where: { schoolId } })
      await raw.student.deleteMany({ where: { schoolId } })
      await raw.person.deleteMany({ where: { schoolId } })
      await raw.school.delete({ where: { id: schoolId } })
    }
    await raw.$disconnect()
  }, 60_000)

  it('ne promeut un élève qu’une fois quand deux promotions partent ensemble', async () => {
    // GIVEN un élève qui a terminé le CP
    const school = await createSchool()
    const studentId = await school.createStudent('Double')
    await school.enroll(studentId, [{ classPeriodId: school.classes.sourceL1.id, endAt: null }])

    // WHEN deux promotions (double clic, deux admins) lisent la période cible encore vide
    const results = await Promise.all([
      promoteStudents(school.promotion),
      promoteStudents(school.promotion),
    ])

    // THEN une seule inscription est créée, la seconde exécution la voit sous le verrou
    const promoted = results.reduce(
      (total, result) => total + (typeof result === 'string' ? 0 : result.promoted),
      0
    )
    expect(promoted).toBe(1)
    expect(await school.openInTarget(studentId)).toBe(1)

    // AND une troisième exécution ne crée rien
    expect(await promoteStudents(school.promotion)).toEqual({ promoted: 0, skipped: 1, errors: [] })
  }, 60_000)

  it('ne remplit jamais la classe cible au-delà de sa capacité', async () => {
    // GIVEN trois élèves de CP pour une classe de CE1 à deux places
    const school = await createSchool({ targetCapacity: 2 })
    for (const name of ['Un', 'Deux', 'Trois']) {
      const studentId = await school.createStudent(name)
      await school.enroll(studentId, [{ classPeriodId: school.classes.sourceL1.id, endAt: null }])
    }

    // WHEN deux promotions concurrentes
    await Promise.all([promoteStudents(school.promotion), promoteStudents(school.promotion)])

    // THEN
    expect(await school.seatsTaken(school.classes.targetL2.id)).toBe(2)
  }, 60_000)

  it("part de l'affectation ouverte, pas d'une affectation close", async () => {
    // GIVEN un élève passé du CP au CE1 en cours d'année
    const school = await createSchool()
    const studentId = await school.createStudent('Moved')
    await school.enroll(studentId, [
      { classPeriodId: school.classes.sourceL1.id, endAt: new Date('2025-12-01') },
      { classPeriodId: school.classes.sourceL2.id, endAt: null },
    ])

    // WHEN
    const result = await promoteStudents(school.promotion)

    // THEN il passe en CE2, le niveau suivant de sa classe actuelle
    expect(result).toEqual({ promoted: 1, skipped: 0, errors: [] })
    expect(await school.seatsTaken(school.classes.targetL3.id)).toBe(1)
    expect(await school.seatsTaken(school.classes.targetL2.id)).toBe(0)
  }, 60_000)

  it("n'inscrit pas un élève archivé", async () => {
    // GIVEN
    const school = await createSchool()
    const studentId = await school.createStudent('Archived', false)
    await school.enroll(studentId, [{ classPeriodId: school.classes.sourceL1.id, endAt: null }])

    // WHEN
    const result = await promoteStudents(school.promotion)

    // THEN
    expect(result).toEqual({ promoted: 0, skipped: 0, errors: [] })
    expect(await raw.enrollment.count({ where: { schoolId: school.schoolId, studentId } })).toBe(1)
  }, 60_000)

  it("n'ouvre pas d'inscription sur une formule archivée", async () => {
    // GIVEN une année terminée dont la formule a été archivée depuis (autorisé : rien d'ouvert)
    const school = await createSchool()
    const studentId = await school.createStudent('Archived plan')
    await school.enroll(studentId, [{ classPeriodId: school.classes.sourceL1.id, endAt: null }])
    await raw.plan.update({ where: { id: school.planId }, data: { isActive: false } })

    // WHEN
    const result = await promoteStudents(school.promotion)

    // THEN l'élève est ignoré, rien n'est écrit dans la période cible
    expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    expect(await school.openInTarget(studentId)).toBe(0)
    expect(await school.seatsTaken(school.classes.targetL2.id)).toBe(0)
  }, 60_000)

  it('ne donne la dernière place qu’à une création quand deux élèves la visent', async () => {
    // GIVEN une classe à une place
    const school = await createSchool({ targetCapacity: 1 })
    const [first, second] = await Promise.all([
      school.createStudent('First'),
      school.createStudent('Second'),
    ])
    const input = (studentId: string) => ({
      schoolId: school.schoolId,
      studentId,
      planId: school.planId,
      classPeriodId: school.classes.targetL2.id,
      discount: 0,
      canLeaveAlone: false,
    })

    // WHEN
    const results = await Promise.all([
      createEnrollment(input(first)),
      createEnrollment(input(second)),
    ])

    // THEN
    expect(results.filter((result) => result === 'classFull')).toHaveLength(1)
    expect(await school.seatsTaken(school.classes.targetL2.id)).toBe(1)
  }, 60_000)

  it('ne donne la dernière place qu’à un changement de classe', async () => {
    // GIVEN deux élèves en CE2 et une place libre en CE1 sur la même période
    const school = await createSchool({ targetCapacity: 1 })
    const enrollmentIds = await Promise.all(
      ['Left', 'Right'].map(async (name) => {
        const studentId = await school.createStudent(name)
        return school.enroll(
          studentId,
          [{ classPeriodId: school.classes.targetL3.id, endAt: null }],
          'ACTIVE'
        )
      })
    )

    // WHEN les deux changements partent ensemble
    const results = await Promise.all(
      enrollmentIds.map((enrollmentId) =>
        reassignClass({
          schoolId: school.schoolId,
          enrollmentId,
          newClassPeriodId: school.classes.targetL2.id,
        })
      )
    )

    // THEN
    expect([...results].sort()).toEqual(['OK', 'classFull'])
    expect(await school.seatsTaken(school.classes.targetL2.id)).toBe(1)
  }, 60_000)

  it('refuse de déplacer une inscription vers une classe d’une autre période', async () => {
    // GIVEN un élève inscrit sur la période source
    const school = await createSchool()
    const studentId = await school.createStudent('Cross')
    const enrollmentId = await school.enroll(
      studentId,
      [{ classPeriodId: school.classes.sourceL1.id, endAt: null }],
      'ACTIVE'
    )

    // WHEN
    const result = await reassignClass({
      schoolId: school.schoolId,
      enrollmentId,
      newClassPeriodId: school.classes.targetL2.id,
    })

    // THEN la période cible ne gagne pas une seconde inscription en cours
    expect(result).toBe('periodMismatch')
    expect(await school.openInTarget(studentId)).toBe(0)
    expect(await school.seatsTaken(school.classes.sourceL1.id)).toBe(1)
  }, 60_000)
})
