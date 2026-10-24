import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUnguardedArchivedClient } from '@/lib/db'
import { purgeSchool, SCHOOL_PURGE_TABLES } from './purge-school.mjs'

/**
 * Non-regression on the cleanup phase of `scripts/migrate-legacy.mjs`.
 *
 * The script used to erase thirteen whole tables. Run for one school against an
 * already multi-school database, it destroyed every other school's data — and since
 * the cleanup transaction commits before the first insertion, the loss outlived the
 * failure of the rest of the migration.
 *
 * The check therefore runs on a two-school database: after purging A, every table of
 * B must return exactly what it returned before.
 */

const databaseUrl = process.env.DATABASE_URL

let raw
let client
let a
let b

async function seedSchool(label, suffix) {
  const school = await raw.school.create({
    data: { name: `purge ${label}`, slug: `purge-${label}-${suffix}` },
  })

  const [admin, parent] = await Promise.all([
    raw.user.create({
      data: { email: `admin-${label}-${suffix}@purge.test`, name: `admin ${label}` },
    }),
    raw.user.create({
      data: { email: `parent-${label}-${suffix}@purge.test`, name: `parent ${label}` },
    }),
  ])

  await raw.schoolMember.createMany({
    data: [
      { userId: admin.id, schoolId: school.id, roles: ['ADMIN'] },
      { userId: parent.id, schoolId: school.id, roles: ['PARENT'] },
    ],
  })

  const family = await raw.family.create({
    data: { schoolId: school.id, name: `fam ${label}`, createdById: admin.id },
  })
  await raw.userFamily.create({
    data: { userId: parent.id, familyId: family.id, schoolId: school.id },
  })
  const person = await raw.person.create({
    data: { schoolId: school.id, name: 'Kid', lastname: label, sex: 'MALE' },
  })
  await raw.familyPerson.create({
    data: { familyId: family.id, personId: person.id, schoolId: school.id, relationType: 'PARENT' },
  })
  const student = await raw.student.create({
    data: { schoolId: school.id, personId: person.id, birthday: new Date('2015-01-01') },
  })
  await raw.phoneNumber.create({
    data: { schoolId: school.id, personId: person.id, phoneNumber: '0600000000' },
  })

  const plan = await raw.plan.create({
    data: { schoolId: school.id, name: `plan ${label}`, amount: 100 },
  })

  // Two chained levels, so the purge has a `LevelProgression` edge to remove.
  const nextLevel = await raw.level.create({
    data: { schoolId: school.id, name: `level ${label} 2` },
  })
  const level = await raw.level.create({
    data: { schoolId: school.id, name: `level ${label} 1` },
  })
  await raw.levelProgression.create({
    data: { schoolId: school.id, levelId: level.id, nextLevelId: nextLevel.id },
  })

  const period = await raw.period.create({
    data: {
      schoolId: school.id,
      name: `period ${label}`,
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-06-30'),
    },
  })
  const classPeriod = await raw.classPeriod.create({
    data: {
      schoolId: school.id,
      name: `class ${label}`,
      capacity: 10,
      levelId: level.id,
      periodId: period.id,
    },
  })

  const enrollment = await raw.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      planId: plan.id,
      status: 'ACTIVE',
      totalAmount: 100,
    },
  })
  await raw.classAssignment.create({
    data: { schoolId: school.id, enrollmentId: enrollment.id, classPeriodId: classPeriod.id },
  })

  const paymentTransaction = await raw.paymentTransaction.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      initiatedById: parent.id,
      amount: 100,
      provider: 'STRIPE',
    },
  })
  await raw.paymentProviderEvent.create({
    data: {
      providerEventId: `evt-${label}-${suffix}`,
      type: 'checkout.session.completed',
      paymentTransactionId: paymentTransaction.id,
    },
  })
  await raw.payment.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      enrollmentId: enrollment.id,
      paymentTransactionId: paymentTransaction.id,
      amount: 50,
      method: 'CARD',
      paidAt: new Date(),
    },
  })

  await raw.invitation.create({
    data: {
      schoolId: school.id,
      email: `invited-${label}-${suffix}@purge.test`,
      role: 'PARENT',
      token: `purge-token-${label}-${suffix}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdById: admin.id,
      familyId: family.id,
    },
  })
  await raw.config.create({
    data: { schoolId: school.id, name: 'theme_primary', value: '#123456', valueType: 'COLOR' },
  })

  return { school, admin, parent }
}

async function countFor(table, schoolId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS n FROM "${table}" WHERE "schoolId" = $1`,
    [schoolId]
  )
  return result.rows[0].n
}

async function countProviderEventsFor(schoolId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM "PaymentProviderEvent" e
     JOIN "PaymentTransaction" t ON t.id = e."paymentTransactionId"
     WHERE t."schoolId" = $1`,
    [schoolId]
  )
  return result.rows[0].n
}

async function dropSchool(fixture) {
  const schoolId = fixture.school.id
  await client.query('BEGIN')
  await purgeSchool(client, schoolId)
  await client.query('COMMIT')
  await raw.config.deleteMany({ where: { schoolId } })
  await raw.schoolMember.deleteMany({ where: { schoolId } })
  await raw.school.delete({ where: { id: schoolId } })
  await raw.user.deleteMany({ where: { id: { in: [fixture.admin.id, fixture.parent.id] } } })
}

it('is never silently skipped in continuous integration', () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('purgeSchool on a two-school database', () => {
  let before

  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()

    const suffix = Date.now().toString(36)
    a = await seedSchool('a', suffix)
    b = await seedSchool('b', suffix)

    before = {}
    for (const table of SCHOOL_PURGE_TABLES) {
      before[table] = await countFor(table, b.school.id)
    }
    before.PaymentProviderEvent = await countProviderEventsFor(b.school.id)

    await client.query('BEGIN')
    await purgeSchool(client, a.school.id)
    await client.query('COMMIT')
  }, 90_000)

  afterAll(async () => {
    if (b) await dropSchool(b)
    if (a) await dropSchool(a)
    if (client) await client.end()
    if (raw) await raw.$disconnect()
  }, 90_000)

  // Without this block, the `toBe(0)` below would pass just as well on an empty base.
  it('has populated every table of the control school', () => {
    for (const table of SCHOOL_PURGE_TABLES) {
      expect(before[table], table).toBeGreaterThan(0)
    }
    expect(before.PaymentProviderEvent).toBeGreaterThan(0)
  })

  it('empties every table of the targeted school', async () => {
    for (const table of SCHOOL_PURGE_TABLES) {
      expect(await countFor(table, a.school.id), table).toBe(0)
    }
    expect(await countProviderEventsFor(a.school.id)).toBe(0)
  })

  it('leaves the other school intact', async () => {
    for (const table of SCHOOL_PURGE_TABLES) {
      expect(await countFor(table, b.school.id), table).toBe(before[table])
    }
    expect(await countProviderEventsFor(b.school.id)).toBe(before.PaymentProviderEvent)
  })

  /**
   * `Config` is in the seed's purge but deliberately out of this one: the script
   * re-imports no configuration, so adding it would wipe the school's theme and logos
   * with nothing to put back.
   */
  it('keeps the configuration and the school itself', async () => {
    expect(await countFor('Config', a.school.id)).toBe(1)
    expect(await countFor('SchoolMember', a.school.id)).toBe(2)

    const school = await raw.school.findUnique({ where: { id: a.school.id } })
    expect(school).not.toBeNull()
  })
})
