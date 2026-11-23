// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FormerStudentDraft } from '@/domain/former-student-import'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { commitFormerStudentImport, previewFormerStudentImport } from './former-student-import'
import { listFormerStudents } from './former-students'

const databaseUrl = process.env.DATABASE_URL
const now = new Date('2026-11-19T10:00:00.000Z')

let raw: PrismaClient
let schoolId: string
let otherSchoolId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

const draft = (overrides: Partial<FormerStudentDraft>): FormerStudentDraft => ({
  id: overrides.id ?? overrides.lastname ?? 'row',
  lastname: 'Durand',
  firstname: 'Léa',
  birthday: '',
  className: 'CM2',
  departureYear: '2023',
  included: true,
  uncertain: [],
  ...overrides,
})

/** Import d'anciens élèves : création archivée, idempotence et isolation entre écoles. */
describe.skipIf(!databaseUrl)('former student import', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-import`
    const [school, otherSchool] = await Promise.all([
      raw.school.create({ data: { name: `import ${suffix}`, slug: `import-${suffix}` } }),
      raw.school.create({ data: { name: `other ${suffix}`, slug: `other-${suffix}` } }),
    ])
    schoolId = school.id
    otherSchoolId = otherSchool.id
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    for (const id of [schoolId, otherSchoolId]) {
      if (!id) continue
      await raw.student.deleteMany({ where: { schoolId: id } })
      await raw.person.deleteMany({ where: { schoolId: id } })
      await raw.school.deleteMany({ where: { id } })
    }
    await raw.$disconnect()
  }, 60_000)

  it('creates archived students only, and a re-run creates nothing more', async () => {
    const rows = [
      draft({ id: 'a', lastname: 'Durand', birthday: '2012-03-04' }),
      draft({ id: 'b', lastname: 'Martin', firstname: 'Hugo', departureYear: '', className: '' }),
      draft({ id: 'c', lastname: '' }),
      draft({ id: 'd', lastname: 'Petit', included: false }),
    ]

    const first = await commitFormerStudentImport({ schoolId, rows }, now)
    expect(first).toEqual({ status: 'OK', created: 2, skipped: 1 })

    const students = await raw.student.findMany({
      where: { schoolId },
      include: { person: true, enrollments: true },
      orderBy: { person: { lastname: 'asc' } },
    })
    expect(
      students.map((student) => ({
        lastname: student.person.lastname,
        isActive: student.isActive,
        leftAt: student.leftAt?.toISOString(),
        birthday: student.birthday?.toISOString() ?? null,
        formerClassLabel: student.formerClassLabel,
        enrollments: student.enrollments.length,
      }))
    ).toEqual([
      {
        lastname: 'Durand',
        isActive: false,
        leftAt: '2023-08-31T00:00:00.000Z',
        birthday: '2012-03-04T00:00:00.000Z',
        formerClassLabel: 'CM2',
        enrollments: 0,
      },
      {
        lastname: 'Martin',
        isActive: false,
        leftAt: now.toISOString(),
        birthday: null,
        formerClassLabel: null,
        enrollments: 0,
      },
    ])
    expect(await raw.familyPerson.count({ where: { schoolId } })).toBe(0)

    const listed = await listFormerStudents(schoolId)
    expect(listed.find((row) => row.name === 'Léa Durand')?.lastClass).toEqual({
      name: 'CM2',
      period: null,
    })

    const preview = await previewFormerStudentImport({ schoolId, rows }, now)
    expect(preview.status === 'OK' && preview.preview.map((row) => row.status)).toEqual([
      'existing',
      'existing',
      'incomplete',
      'create',
    ])

    const second = await commitFormerStudentImport({ schoolId, rows }, now)
    expect(second).toEqual({ status: 'OK', created: 0, skipped: 3 })
    expect(await raw.student.count({ where: { schoolId } })).toBe(2)
  })

  it('flags an active namesake as a homonym and still creates the row', async () => {
    const person = await raw.person.create({
      data: { schoolId, name: 'Nora', lastname: 'Benali' },
    })
    await raw.student.create({ data: { schoolId, personId: person.id, isActive: true } })
    const rows = [draft({ id: 'h', lastname: 'Benali', firstname: 'Nora' })]

    const preview = await previewFormerStudentImport({ schoolId, rows }, now)
    expect(preview.status === 'OK' && preview.preview[0]?.status).toBe('homonym')
    expect(await commitFormerStudentImport({ schoolId, rows }, now)).toEqual({
      status: 'OK',
      created: 1,
      skipped: 0,
    })
  })

  it("never sees nor writes another school's students", async () => {
    const rows = [draft({ id: 'x', lastname: 'Durand', birthday: '2012-03-04' })]

    const preview = await previewFormerStudentImport({ schoolId: otherSchoolId, rows }, now)
    expect(preview.status === 'OK' && preview.preview[0]?.status).toBe('create')

    const before = await raw.student.count({ where: { schoolId } })
    expect(await commitFormerStudentImport({ schoolId: otherSchoolId, rows }, now)).toEqual({
      status: 'OK',
      created: 1,
      skipped: 0,
    })
    expect(await raw.student.count({ where: { schoolId } })).toBe(before)
    expect(await raw.student.count({ where: { schoolId: otherSchoolId } })).toBe(1)
    const created = await raw.person.findMany({ where: { schoolId: otherSchoolId } })
    expect(created.map((person) => person.lastname)).toEqual(['Durand'])
  })

  it('rejects more than 500 rows without writing', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => draft({ id: `r${i}`, lastname: `N${i}` }))
    expect(await commitFormerStudentImport({ schoolId, rows }, now)).toEqual({
      status: 'validationError',
    })
  })
})
