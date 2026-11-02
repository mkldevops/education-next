// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { childcareGateway } from '@/gateways/childcare-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient, db } from '@/lib/db'
import { billChildcareMonth } from '@/use-cases/childcare/bill-childcare-month'
import { saveChildcareSubscription } from '@/use-cases/childcare/save-childcare-subscription'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { cancelReceipt } from '@/use-cases/receipts/cancel-receipt'
import { recordReceipt } from '@/use-cases/receipts/record-receipt'

const databaseUrl = process.env.DATABASE_URL
const MONTH = new Date().toISOString().slice(0, 7)
const TODAY = new Date().toISOString().slice(0, 10)

let raw: PrismaClient
const schools: string[] = []
const users: string[] = []

async function seedSchool() {
  const tag = randomUUID().slice(0, 8)
  const { id: schoolId } = await raw.school.create({
    data: { name: `childcare ${tag}`, slug: `childcare-${tag}` },
  })
  const { id: userId } = await raw.user.create({ data: { email: `${tag}@childcare.test` } })
  schools.push(schoolId)
  users.push(userId)
  await raw.config.create({
    data: { schoolId, name: 'meals_enabled', value: 'true', valueType: 'BOOLEAN' },
  })
  const period = await raw.period.create({
    data: {
      schoolId,
      name: tag,
      startAt: new Date(`${TODAY}T00:00:00.000Z`),
      endAt: new Date(Date.now() + 90 * 86_400_000),
    },
  })
  await raw.mealPrice.create({
    data: {
      schoolId,
      service: 'CANTEEN',
      amount: 500,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    },
  })

  const addFamily = (name: string) =>
    raw.family.create({ data: { schoolId, name, createdById: userId } })

  const addChild = async (familyId: string, lastname: string) => {
    const person = await raw.person.create({ data: { schoolId, name: 'Enfant', lastname } })
    await raw.familyPerson.create({
      data: { schoolId, familyId, personId: person.id, relationType: 'PARENT' },
    })
    return raw.student.create({ data: { schoolId, personId: person.id } })
  }

  const addDebt = async (studentId: string) => {
    await saveChildcareSubscription({
      schoolId,
      studentId,
      monthlyAmount: 6000,
      startMonth: MONTH,
      endMonth: null,
    })
    await billChildcareMonth({ schoolId, recordedById: userId, month: MONTH })
    const [charge] = await raw.childcareCharge.findMany({
      where: { schoolId, subscription: { studentId } },
    })
    return charge.id
  }

  const addCanteen = async (studentId: string) => {
    const account = await raw.mealAccount.create({
      data: { schoolId, studentId, service: 'CANTEEN' },
    })
    await raw.mealSchedule.create({
      data: {
        schoolId,
        accountId: account.id,
        periodId: period.id,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        startOn: period.startAt,
      },
    })
    const summaries = await db.$transaction((tx) =>
      loadMealAccountSummaries(tx, {
        schoolId,
        accounts: [{ id: account.id, service: 'CANTEEN' }],
        today: TODAY,
      })
    )
    const paidThrough = summaries.get(account.id)?.coverage.paidThrough ?? null
    return {
      studentId,
      service: 'CANTEEN' as const,
      amount: 500,
      expectedPaidThrough: paidThrough,
    }
  }

  const archive = (id: string) =>
    raw.student.update({ where: { id_schoolId: { id, schoolId } }, data: { isActive: false } })

  const pay = (
    familyId: string,
    lines: {
      childcare?: Array<{ chargeId: string; amount: number }>
      meals?: Array<Awaited<ReturnType<typeof addCanteen>>>
    }
  ) =>
    recordReceipt({
      schoolId,
      recordedById: userId,
      familyId,
      idempotencyKey: randomUUID(),
      method: 'CASH',
      tuition: 0,
      meals: lines.meals ?? [],
      childcare: lines.childcare ?? [],
    })

  const paidOn = async (chargeId: string) => {
    const rows = await raw.childcarePayment.findMany({
      where: { schoolId, chargeId, receipt: { cancelledAt: null } },
    })
    return rows.reduce((sum, row) => sum + Number(row.amount), 0)
  }

  return { schoolId, userId, addFamily, addChild, addDebt, addCanteen, archive, pay, paidOn }
}

async function purge(schoolId: string) {
  const where = { schoolId }
  await raw.childcarePayment.deleteMany({ where })
  await raw.mealPayment.deleteMany({ where })
  await raw.receipt.deleteMany({ where })
  await raw.receiptCounter.deleteMany({ where })
  await raw.childcareCharge.deleteMany({ where })
  await raw.childcareSubscription.deleteMany({ where })
  await raw.mealSchedule.deleteMany({ where })
  await raw.mealAccount.deleteMany({ where })
  await raw.mealPrice.deleteMany({ where })
  await raw.period.deleteMany({ where })
  await raw.config.deleteMany({ where })
  await raw.student.deleteMany({ where })
  await raw.familyPerson.deleteMany({ where })
  await raw.person.deleteMany({ where })
  await raw.family.deleteMany({ where })
  await raw.school.delete({ where: { id: schoolId } })
}

describe.skipIf(!databaseUrl)('garderie sur une vraie base', () => {
  beforeAll(() => {
    raw = createUnguardedArchivedClient()
  })

  afterAll(async () => {
    if (!raw) return
    for (const schoolId of schools) await purge(schoolId)
    await raw.user.deleteMany({ where: { id: { in: users } } })
    await raw.$disconnect()
  }, 60_000)

  describe('searchStudents', () => {
    it('finds an active child of this school, not an archived one or another school', async () => {
      const a = await seedSchool()
      const b = await seedSchool()
      const family = await a.addFamily('A')
      const active = await a.addChild(family.id, 'Zanatany')
      const archived = await a.addChild(family.id, 'Zanatani')
      await a.archive(archived.id)
      const elsewhere = await b.addChild((await b.addFamily('B')).id, 'Zanatane')

      const found = await childcareGateway.searchStudents(a.schoolId, 'zanat')

      expect(found.map((row) => row.id)).toEqual([active.id])
      expect(found[0].person).toEqual({ name: 'Enfant', lastname: 'Zanatany' })
      expect(found.map((row) => row.id)).not.toContain(elsewhere.id)
    }, 30_000)
  })

  describe('dette garderie en caisse', () => {
    it('takes the debt of an active child', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const child = await s.addChild(family.id, 'Actif')
      const chargeId = await s.addDebt(child.id)

      const receipt = await s.pay(family.id, { childcare: [{ chargeId, amount: 1000 }] })

      expect(receipt).toEqual({ id: expect.any(String) })
      expect(await s.paidOn(chargeId)).toBe(1000)
    }, 30_000)

    it('takes then reopens the existing debt of an archived child', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const child = await s.addChild(family.id, 'Archive')
      const chargeId = await s.addDebt(child.id)
      await s.archive(child.id)

      const receipt = await s.pay(family.id, { childcare: [{ chargeId, amount: 1000 }] })

      expect(receipt).toEqual({ id: expect.any(String) })
      expect(await s.paidOn(chargeId)).toBe(1000)
      expect(
        await cancelReceipt({
          schoolId: s.schoolId,
          cancelledById: s.userId,
          receiptId: (receipt as { id: string }).id,
          reason: 'erreur',
        })
      ).toBe('OK')
      expect(await s.paidOn(chargeId)).toBe(0)
    }, 30_000)

    it('refuses the archived child debt from a family that does not owe it', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const stranger = await s.addFamily('B')
      const child = await s.addChild(family.id, 'Archive')
      const chargeId = await s.addDebt(child.id)
      await s.archive(child.id)

      expect(await s.pay(stranger.id, { childcare: [{ chargeId, amount: 1000 }] })).toBe(
        'notInFamily'
      )
      expect(await s.paidOn(chargeId)).toBe(0)
    }, 30_000)

    it('refuses the archived child debt of another school', async () => {
      const a = await seedSchool()
      const b = await seedSchool()
      const family = await a.addFamily('A')
      const child = await a.addChild(family.id, 'Archive')
      const chargeId = await a.addDebt(child.id)
      await a.archive(child.id)
      const local = await b.addFamily('B')

      expect(await b.pay(local.id, { childcare: [{ chargeId, amount: 1000 }] })).toBe('staleState')
      expect(await a.paidOn(chargeId)).toBe(0)
    }, 30_000)

    it('refuses a child without any family link', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const child = await s.addChild(family.id, 'Orphelin')
      const chargeId = await s.addDebt(child.id)
      await s.archive(child.id)
      await raw.familyPerson.deleteMany({ where: { schoolId: s.schoolId, familyId: family.id } })

      expect(await s.pay(family.id, { childcare: [{ chargeId, amount: 1000 }] })).toBe(
        'notInFamily'
      )
    }, 30_000)

    it('mixes the archived child debt with the canteen of an active sibling', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const archived = await s.addChild(family.id, 'Archive')
      const sibling = await s.addChild(family.id, 'Actif')
      const chargeId = await s.addDebt(archived.id)
      await s.archive(archived.id)
      const meal = await s.addCanteen(sibling.id)

      const receipt = await s.pay(family.id, {
        childcare: [{ chargeId, amount: 1000 }],
        meals: [meal],
      })

      expect(receipt).toEqual({ id: expect.any(String) })
      expect(await s.paidOn(chargeId)).toBe(1000)
      expect(await raw.mealPayment.count({ where: { schoolId: s.schoolId } })).toBe(1)
    }, 30_000)

    it('keeps refusing the canteen of an archived child, even beside its own debt', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const child = await s.addChild(family.id, 'Archive')
      const chargeId = await s.addDebt(child.id)
      const meal = await s.addCanteen(child.id)
      await s.archive(child.id)

      expect(await s.pay(family.id, { meals: [meal] })).toBe('notInFamily')
      expect(
        await s.pay(family.id, { childcare: [{ chargeId, amount: 1000 }], meals: [meal] })
      ).toBe('notInFamily')
      expect(await raw.receipt.count({ where: { schoolId: s.schoolId } })).toBe(0)
    }, 30_000)

    it('keeps refusing a new childcare subscription for an archived child', async () => {
      const s = await seedSchool()
      const family = await s.addFamily('A')
      const child = await s.addChild(family.id, 'Archive')
      await s.archive(child.id)

      expect(
        await saveChildcareSubscription({
          schoolId: s.schoolId,
          studentId: child.id,
          monthlyAmount: 6000,
          startMonth: MONTH,
          endMonth: null,
        })
      ).toBe('notFound')
    }, 30_000)
  })
})
