// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { loadCashDay, loadUnreceiptedPayments } from './cash-day-data'

const databaseUrl = process.env.DATABASE_URL
const TIME_ZONE = 'Indian/Comoro'
const DAY = '2026-10-24'
// Le jour local va de 21:00Z la veille à 21:00Z.
const at = (time: string) => new Date(`2026-10-24T${time}:00.000Z`)
const DAY_BEFORE = new Date('2026-10-23T20:59:00.000Z')

type Fixture = {
  schoolId: string
  familyId: string
  enrollmentIds: [string, string]
  receiptId: string
}

let raw: PrismaClient
let suffix: string
let a: Fixture
let b: Fixture

async function seedSchool(label: string, receiptTotal: number): Promise<Fixture> {
  const school = await raw.school.create({
    data: { name: `cash day ${label} ${suffix}`, slug: `cash-day-${label}-${suffix}` },
  })
  const schoolId = school.id
  const admin = await raw.user.create({ data: { email: `${label}-${suffix}@cash-day.test` } })
  const plan = await raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 50000 } })
  const family = await raw.family.create({
    data: { schoolId, name: `Famille ${label}`, createdById: admin.id },
  })
  const enrollmentIds: string[] = []
  for (const name of ['Inès', 'Yanis']) {
    const person = await raw.person.create({ data: { schoolId, name, lastname: label } })
    await raw.familyPerson.create({
      data: { schoolId, familyId: family.id, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    const enrollment = await raw.enrollment.create({
      data: {
        schoolId,
        studentId: student.id,
        planId: plan.id,
        totalAmount: 50000,
        status: 'ACTIVE',
      },
    })
    enrollmentIds.push(enrollment.id)
  }
  const receipt = await raw.receipt.create({
    data: {
      schoolId,
      familyId: family.id,
      number: 1,
      total: receiptTotal,
      method: 'CASH',
      paidAt: at('08:00'),
      recordedById: admin.id,
      idempotencyKey: randomUUID(),
      requestHash: 'test',
      createdAt: at('08:00'),
    },
  })

  return {
    schoolId,
    familyId: family.id,
    enrollmentIds: [enrollmentIds[0], enrollmentIds[1]],
    receiptId: receipt.id,
  }
}

const payment = (
  fixture: Fixture,
  amount: number,
  createdAt: Date,
  extra: { enrollment?: 0 | 1; receiptId?: string; isActive?: boolean } = {}
) => ({
  schoolId: fixture.schoolId,
  familyId: fixture.familyId,
  enrollmentId: fixture.enrollmentIds[extra.enrollment ?? 0],
  amount,
  method: 'CASH' as const,
  paidAt: createdAt,
  createdAt,
  receiptId: extra.receiptId,
  isActive: extra.isActive ?? true,
})

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('cash day reads', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
    a = await seedSchool('a', 15000)
    b = await seedSchool('b', 99000)

    await raw.payment.createMany({
      data: [
        // Sous reçu : dans la caisse, jamais dans « sans reçu ».
        payment(a, 15000, at('08:00'), { receiptId: a.receiptId }),
        // Une somme versée, ventilée sur deux inscriptions.
        payment(a, 5000, at('09:00'), { enrollment: 0 }),
        payment(a, 4000, at('09:00'), { enrollment: 1 }),
        // Remboursement : jamais de reçu.
        payment(a, -2000, at('10:00')),
        // Saisie annulée, puis saisie de la veille.
        payment(a, 7000, at('11:00'), { isActive: false }),
        payment(a, 3000, DAY_BEFORE),
        payment(b, 99000, at('08:00'), { receiptId: b.receiptId }),
        payment(b, 88000, at('09:30')),
      ],
    })
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    const schoolIds = [a, b].flatMap((fixture) => (fixture ? [fixture.schoolId] : []))
    const scoped = { where: { schoolId: { in: schoolIds } } }
    await raw.payment.deleteMany(scoped)
    await raw.receipt.deleteMany(scoped)
    await raw.enrollment.deleteMany(scoped)
    await raw.plan.deleteMany(scoped)
    await raw.student.deleteMany(scoped)
    await raw.familyPerson.deleteMany(scoped)
    await raw.person.deleteMany(scoped)
    await raw.family.deleteMany(scoped)
    await raw.user.deleteMany({ where: { email: { endsWith: `-${suffix}@cash-day.test` } } })
    await raw.school.deleteMany({ where: { id: { in: schoolIds } } })
    await raw.$disconnect()
  }, 60_000)

  it("counts a school's own receipts, never another school's", async () => {
    const cash = await loadCashDay(a.schoolId, DAY, TIME_ZONE)

    expect(cash.net).toMatchObject({ count: 1, total: 15000 })
    expect(cash.net.byLine).toEqual({ CANTEEN: 0, SNACK: 0, CHILDCARE: 0, TUITION: 15000 })
    expect(cash.issuedRows.map((row) => row.id)).toEqual([a.receiptId])
    expect(cash.issuedRows.map((row) => row.familyId)).toEqual([a.familyId])
  })

  it("lists a school's own payments without a receipt, never another school's", async () => {
    const unreceipted = await loadUnreceiptedPayments(a.schoolId, DAY, TIME_ZONE)

    expect(unreceipted.rows.map((row) => row.familyId)).toEqual([a.familyId, a.familyId])
    expect(unreceipted.rows.map((row) => row.family)).toEqual(['Famille a', 'Famille a'])
    expect(unreceipted.rows.map((row) => row.amount)).toEqual([9000, -2000])
    expect(unreceipted.total).toBe(7000)
  })

  it('gives the other school its own day only', async () => {
    const [cash, unreceipted] = await Promise.all([
      loadCashDay(b.schoolId, DAY, TIME_ZONE),
      loadUnreceiptedPayments(b.schoolId, DAY, TIME_ZONE),
    ])

    expect(cash.issuedRows.map((row) => row.id)).toEqual([b.receiptId])
    expect(cash.net.total).toBe(99000)
    expect(unreceipted.rows.map((row) => row.familyId)).toEqual([b.familyId])
    expect(unreceipted.total).toBe(88000)
  })

  it('keeps receipts the only source of the cash total', async () => {
    const cash = await loadCashDay(a.schoolId, DAY, TIME_ZONE)
    const unreceipted = await loadUnreceiptedPayments(a.schoolId, DAY, TIME_ZONE)

    expect(unreceipted.total).not.toBe(0)
    expect(cash.issued.total).toBe(15000)
  })

  it('leaves a payment recorded the day before on its own day', async () => {
    const unreceipted = await loadUnreceiptedPayments(a.schoolId, '2026-10-23', TIME_ZONE)

    expect(unreceipted.rows.map((row) => row.amount)).toEqual([3000])
  })
})
