// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

let raw: PrismaClient
let userId: string
const schools: string[] = []

async function seedSchool(suffix: string) {
  const school = await raw.school.create({
    data: { name: `Attach ${suffix}`, slug: `attach-${suffix}` },
  })
  schools.push(school.id)
  const family = await raw.family.create({
    data: { schoolId: school.id, name: 'Famille', createdById: userId },
  })
  const person = await raw.person.create({
    data: { schoolId: school.id, name: 'Enfant', lastname: 'Seul' },
  })
  const student = await raw.student.create({
    data: { schoolId: school.id, personId: person.id },
  })
  return { schoolId: school.id, familyId: family.id, studentId: student.id, personId: person.id }
}

describe.skipIf(!process.env.DATABASE_URL)('familyGateway.attachStudent', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })
  beforeEach(async () => {
    const user = await raw.user.create({ data: { email: `attach-${randomUUID()}@test.invalid` } })
    userId = user.id
  })
  afterEach(async () => {
    for (const schoolId of schools.splice(0)) {
      const families = await raw.family.findMany({ where: { schoolId }, select: { id: true } })
      for (const family of families) await familyGateway.deleteWithRelated(schoolId, family.id)
      await raw.student.deleteMany({ where: { schoolId } })
      await raw.person.deleteMany({ where: { schoolId } })
      await raw.school.delete({ where: { id: schoolId } })
    }
    await raw.user.delete({ where: { id: userId } })
  })
  afterAll(async () => {
    await raw?.$disconnect()
  })

  it('links a student without family as a child of the family', async () => {
    const a = await seedSchool(randomUUID())
    expect(await familyGateway.attachStudent(a.schoolId, a.familyId, a.studentId)).toBe('OK')
    const link = await raw.familyPerson.findFirst({ where: { personId: a.personId } })
    expect(link).toMatchObject({ familyId: a.familyId, relationType: 'OTHER' })
    expect(await familyGateway.attachStudent(a.schoolId, a.familyId, a.studentId)).toBe('hasFamily')
  })

  it('refuses a family or a student of another school', async () => {
    const a = await seedSchool(randomUUID())
    const b = await seedSchool(randomUUID())
    expect(await familyGateway.attachStudent(a.schoolId, b.familyId, a.studentId)).toBe('notFound')
    expect(await familyGateway.attachStudent(a.schoolId, a.familyId, b.studentId)).toBe('notFound')
    expect(
      await raw.familyPerson.count({ where: { schoolId: { in: [a.schoolId, b.schoolId] } } })
    ).toBe(0)
  })

  it('creates a family around a student without family, once', async () => {
    const a = await seedSchool(randomUUID())
    const created = await familyGateway.createForStudent(a.schoolId, a.studentId, {
      name: 'Seul',
      createdById: userId,
    })
    if (typeof created === 'string') throw new Error(created)
    expect(created.name).toBe('Seul')
    const link = await raw.familyPerson.findFirst({ where: { personId: a.personId } })
    expect(link).toMatchObject({ familyId: created.id, relationType: 'OTHER' })
    expect(
      await familyGateway.createForStudent(a.schoolId, a.studentId, {
        name: 'Autre',
        createdById: userId,
      })
    ).toBe('hasFamily')
  })

  it('refuses to create a family for a student of another school', async () => {
    const a = await seedSchool(randomUUID())
    const b = await seedSchool(randomUUID())
    expect(
      await familyGateway.createForStudent(a.schoolId, b.studentId, {
        name: 'Intrus',
        createdById: userId,
      })
    ).toBe('notFound')
    expect(await raw.family.count({ where: { schoolId: a.schoolId, name: 'Intrus' } })).toBe(0)
  })
})
