import { createHash, randomUUID } from 'node:crypto'
import type { PrismaClient } from '../src/generated/prisma/client'

/**
 * Garderie de démonstration : une famille par situation que l'écran doit savoir montrer
 * (retard, mois dû, acompte, reprise, mois annulé, arrêt, enfant archivé, enfant sans
 * famille). Les mois sont relatifs au mois courant, pour que la démo reste vivante.
 *
 * Rejouable : les familles et enfants nommés ici sont supprimés puis recréés, rien d'autre.
 */

type Charge = {
  offset: number
  paid?: number | 'all'
  cancelled?: string
}

type Child = {
  name: string
  sex: 'MALE' | 'FEMALE'
  rate: number
  start: number
  end?: number
  archived?: boolean
  opening?: { through: number; reason: string }
  charges?: Charge[]
}

type Household = { family: string | null; parent?: string; children: Child[] }

const all = (from: number, to: number, paid: Charge['paid'] = 'all'): Charge[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({ offset: from + index, paid }))

export const CHILDCARE_HOUSEHOLDS: Household[] = [
  {
    family: 'Okafor',
    parent: 'Grace',
    children: [
      {
        name: 'Chidi',
        sex: 'MALE',
        rate: 50,
        start: -5,
        charges: [...all(-5, -4), ...all(-3, 0, 0)],
      },
    ],
  },
  {
    family: 'Nguyen',
    parent: 'Linh',
    children: [
      {
        name: 'Léa',
        sex: 'FEMALE',
        rate: 40,
        start: -2,
        charges: [
          { offset: -2, paid: 'all' },
          { offset: -1, cancelled: 'Absente tout le mois (voyage)' },
          { offset: 0, paid: 'all' },
        ],
      },
      { name: 'Minh', sex: 'MALE', rate: 40, start: -2, charges: all(-2, 0) },
    ],
  },
  {
    family: 'Lambert',
    parent: 'Sophie',
    children: [
      {
        name: 'Lucas',
        sex: 'MALE',
        rate: 50,
        start: -1,
        charges: [
          { offset: -1, paid: 'all' },
          { offset: 0, paid: 20 },
        ],
      },
    ],
  },
  {
    family: 'Mendes',
    parent: 'Ana',
    children: [
      {
        name: 'Tiago',
        sex: 'MALE',
        rate: 45,
        start: -6,
        opening: { through: -2, reason: 'Réglé en espèces avant l’application' },
        charges: [
          { offset: -3, paid: 0 },
          { offset: -2, paid: 0 },
          { offset: -1, paid: 'all' },
          { offset: 0, paid: 'all' },
        ],
      },
    ],
  },
  {
    family: 'Diop',
    parent: 'Awa',
    children: [
      { name: 'Moussa', sex: 'MALE', rate: 45, start: -5, end: -2, charges: all(-5, -2) },
      { name: 'Fatou', sex: 'FEMALE', rate: 35, start: 0 },
    ],
  },
  {
    family: 'Rossi',
    parent: 'Chiara',
    children: [{ name: 'Giulia', sex: 'FEMALE', rate: 45, start: -4, end: 0, charges: all(-4, 0) }],
  },
  {
    family: 'Kaya',
    parent: 'Elif',
    children: [
      {
        name: 'Emir',
        sex: 'MALE',
        rate: 45,
        start: -3,
        end: -1,
        archived: true,
        charges: [...all(-3, -2), { offset: -1, paid: 0 }],
      },
    ],
  },
  {
    family: 'Ferreira',
    parent: 'Inês',
    children: [
      {
        name: 'Rafael',
        sex: 'MALE',
        rate: 40,
        start: -2,
        charges: [...all(-2, -1), { offset: 0, paid: 0 }],
      },
      { name: 'Sofia', sex: 'FEMALE', rate: 30, start: -2, charges: all(-2, 0) },
    ],
  },
  {
    family: null,
    children: [
      { name: 'Nour', sex: 'FEMALE', rate: 40, start: 0 },
      { name: 'Adam', sex: 'MALE', rate: 45, start: -1, charges: all(-1, 0, 0) },
    ],
  },
]

const ORPHAN_LASTNAMES = { Nour: 'Saïd', Adam: 'Petit' } as Record<string, string>

const lastnameOf = (household: Household, child: Child) =>
  household.family ?? ORPHAN_LASTNAMES[child.name] ?? 'Garderie'

const monthAt = (today: Date, offset: number) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1))

async function removeChildcareFixtures(prisma: PrismaClient, schoolId: string) {
  const families = [
    ...CHILDCARE_HOUSEHOLDS.flatMap((household) => (household.family ? [household.family] : [])),
    ...Object.values(ORPHAN_LASTNAMES),
  ]
  const names = CHILDCARE_HOUSEHOLDS.flatMap((household) =>
    household.children.map((child) => ({
      name: child.name,
      lastname: lastnameOf(household, child),
    }))
  )
  const familyRows = await prisma.family.findMany({
    where: { schoolId, name: { in: families } },
    select: { id: true },
  })
  const familyIds = familyRows.map((family) => family.id)
  const persons = await prisma.person.findMany({
    where: {
      schoolId,
      OR: [{ families: { some: { familyId: { in: familyIds } } } }, ...names],
    },
    select: { id: true },
  })
  const personIds = persons.map((person) => person.id)

  await prisma.receipt.deleteMany({ where: { schoolId, familyId: { in: familyIds } } })
  await prisma.student.deleteMany({ where: { schoolId, personId: { in: personIds } } })
  await prisma.familyPerson.deleteMany({ where: { schoolId, personId: { in: personIds } } })
  await prisma.phoneNumber.deleteMany({ where: { schoolId, personId: { in: personIds } } })
  await prisma.person.deleteMany({ where: { schoolId, id: { in: personIds } } })
  await prisma.family.deleteMany({ where: { schoolId, id: { in: familyIds } } })
}

async function nextReceiptNumber(prisma: PrismaClient, schoolId: string) {
  const rows = await prisma.$queryRaw<Array<{ number: number }>>`
    INSERT INTO "ReceiptCounter" ("schoolId", "next") VALUES (${schoolId}, 2)
    ON CONFLICT ("schoolId") DO UPDATE SET "next" = "ReceiptCounter"."next" + 1
    RETURNING "next" - 1 AS "number"`
  return rows[0].number
}

export async function seedChildcare(
  prisma: PrismaClient,
  { schoolId, recordedById, today }: { schoolId: string; recordedById: string; today: Date }
) {
  await removeChildcareFixtures(prisma, schoolId)
  await prisma.config.deleteMany({ where: { schoolId, name: 'meals_enabled' } })
  await prisma.config.create({
    data: { schoolId, name: 'meals_enabled', value: 'true', valueType: 'BOOLEAN' },
  })

  let subscriptions = 0
  let receipts = 0
  for (const household of CHILDCARE_HOUSEHOLDS) {
    const family = household.family
      ? await prisma.family.create({
          data: {
            schoolId,
            name: household.family,
            emergencyContactName: `${household.parent} ${household.family}`,
            createdById: recordedById,
          },
        })
      : null
    if (family && household.parent) {
      await prisma.person.create({
        data: {
          schoolId,
          name: household.parent,
          lastname: family.name,
          sex: 'FEMALE',
          families: { create: { familyId: family.id, relationType: 'PARENT' } },
        },
      })
    }

    for (const child of household.children) {
      const person = await prisma.person.create({
        data: {
          schoolId,
          name: child.name,
          lastname: lastnameOf(household, child),
          sex: child.sex,
          families: family ? { create: { familyId: family.id, relationType: 'OTHER' } } : undefined,
        },
      })
      const student = await prisma.student.create({
        data: {
          schoolId,
          personId: person.id,
          birthday: new Date(Date.UTC(today.getUTCFullYear() - 6, 3, 12)),
          isActive: !child.archived,
        },
      })
      const subscription = await prisma.childcareSubscription.create({
        data: {
          schoolId,
          studentId: student.id,
          monthlyAmount: child.rate,
          startMonth: monthAt(today, child.start),
          endMonth: child.end === undefined ? null : monthAt(today, child.end),
          openingPaidThrough: child.opening ? monthAt(today, child.opening.through) : null,
          openingReason: child.opening?.reason,
          openingRecordedById: child.opening ? recordedById : null,
          openingRecordedAt: child.opening ? new Date() : null,
        },
      })
      subscriptions += 1

      for (const charge of child.charges ?? []) {
        const month = monthAt(today, charge.offset)
        const created = await prisma.childcareCharge.create({
          data: {
            schoolId,
            subscriptionId: subscription.id,
            month,
            amount: child.rate,
            recordedById,
            cancelledAt: charge.cancelled ? new Date() : null,
            cancelledById: charge.cancelled ? recordedById : null,
            cancelReason: charge.cancelled,
          },
        })
        const amount = charge.paid === 'all' ? child.rate : (charge.paid ?? 0)
        if (charge.cancelled || amount <= 0 || !family) continue

        const idempotencyKey = randomUUID()
        const receipt = await prisma.receipt.create({
          data: {
            schoolId,
            familyId: family.id,
            number: await nextReceiptNumber(prisma, schoolId),
            total: amount,
            method: charge.offset % 2 === 0 ? 'CASH' : 'TRANSFER',
            paidAt: new Date(month.getTime() + 4 * 24 * 60 * 60 * 1000),
            recordedById,
            idempotencyKey,
            requestHash: createHash('sha256').update(idempotencyKey).digest('hex'),
          },
        })
        await prisma.childcarePayment.create({
          data: { schoolId, receiptId: receipt.id, chargeId: created.id, amount },
        })
        receipts += 1
      }
    }
  }

  return { subscriptions, receipts }
}
