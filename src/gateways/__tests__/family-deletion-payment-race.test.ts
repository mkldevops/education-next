// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

/**
 * Suppression d'une famille pendant un encaissement, sur une vraie base.
 *
 * L'encaissement verrouille `Family` puis insère un `Payment`, qui pose un `KEY SHARE` sur
 * l'inscription. Sans verrou en tête, la suppression efface l'inscription puis attend la
 * famille : les deux transactions s'attendent et Postgres en tue une. Avec le verrou, la
 * suppression attend dès sa première requête, et les deux aboutissent l'une après l'autre.
 */

const databaseUrl = process.env.DATABASE_URL

let raw: PrismaClient
let fixture: Awaited<ReturnType<typeof seed>>

async function seed(suffix: string) {
  const school = await raw.school.create({
    data: { name: `race ${suffix}`, slug: `race-${suffix}` },
  })
  const schoolId = school.id
  const admin = await raw.user.create({ data: { email: `admin-${suffix}@race.test` } })
  const family = await raw.family.create({
    data: { schoolId, name: 'Course', createdById: admin.id },
  })
  const child = await raw.person.create({ data: { schoolId, name: 'Léa', lastname: 'Course' } })
  await raw.familyPerson.create({
    data: { schoolId, familyId: family.id, personId: child.id, relationType: 'SIBLING' },
  })
  const student = await raw.student.create({ data: { schoolId, personId: child.id } })
  const plan = await raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 100 } })
  const enrollment = await raw.enrollment.create({
    data: { schoolId, studentId: student.id, planId: plan.id, status: 'ACTIVE', totalAmount: 100 },
  })
  return { schoolId, admin, family, enrollment }
}

async function waitForLockWaiter() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await raw.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query LIKE '%"Family"%'`
    if (Number(rows[0].count) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('deletion never waited on the family lock')
}

describe.skipIf(!databaseUrl)('familyGateway.deleteWithRelated face à un encaissement', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    fixture = await seed(Date.now().toString(36))
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    const { schoolId } = fixture
    await raw.payment.deleteMany({ where: { schoolId } })
    await raw.enrollment.deleteMany({ where: { schoolId } })
    await raw.student.deleteMany({ where: { schoolId } })
    await raw.familyPerson.deleteMany({ where: { schoolId } })
    await raw.person.deleteMany({ where: { schoolId } })
    await raw.family.deleteMany({ where: { schoolId } })
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.user.delete({ where: { id: fixture.admin.id } })
    await raw.$disconnect()
  }, 60_000)

  it("attend l'encaissement en cours au lieu de finir en deadlock", async () => {
    const { schoolId, family, enrollment } = fixture
    let deletion: Promise<boolean> | undefined

    await raw.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "Family"
          WHERE "id" = ${family.id} AND "schoolId" = ${schoolId}
          FOR NO KEY UPDATE`

        deletion = familyGateway.deleteWithRelated(schoolId, family.id)
        await waitForLockWaiter()

        await tx.payment.create({
          data: {
            schoolId,
            familyId: family.id,
            enrollmentId: enrollment.id,
            amount: 100,
            method: 'CASH',
            paidAt: new Date(),
          },
        })
      },
      { timeout: 15_000 }
    )

    await expect(deletion).resolves.toBe(true)
    await expect(raw.family.findUnique({ where: { id: family.id } })).resolves.toBeNull()
    await expect(raw.payment.count({ where: { schoolId } })).resolves.toBe(0)
  }, 30_000)
})
