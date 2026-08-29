// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient, db } from '@/lib/db'
import { TenantScopeError } from '@/lib/tenant-guard'

/**
 * Isolation inter-écoles, sur une vraie base.
 *
 * Ces tests ne mockent pas `db` : avec un mock ils ne vérifieraient que le mock et
 * passeraient quelle que soit la requête. Le point de contrôle est que la base
 * elle-même ne rende jamais une ligne de l'école B à une requête portée par A.
 *
 * Les fixtures sont écrites par un client sans garde ni soft-delete ; toutes les
 * assertions passent par le `db` applicatif, extensions comprises.
 */

const databaseUrl = process.env.DATABASE_URL

type Fixture = Awaited<ReturnType<typeof seedSchool>>

let raw: PrismaClient
let a: Fixture
let b: Fixture

async function seedSchool(label: string, suffix: string) {
  const school = await raw.school.create({
    data: { name: `iso ${label}`, slug: `iso-${label}-${suffix}` },
  })

  const [admin, parent] = await Promise.all([
    raw.user.create({
      data: { email: `admin-${label}-${suffix}@iso.test`, name: `admin ${label}` },
    }),
    raw.user.create({
      data: { email: `parent-${label}-${suffix}@iso.test`, name: `parent ${label}` },
    }),
  ])

  await raw.schoolMember.createMany({
    data: [
      { userId: admin.id, schoolId: school.id, role: 'ADMIN' },
      { userId: parent.id, schoolId: school.id, role: 'PARENT' },
    ],
  })

  const family = await raw.family.create({
    data: { schoolId: school.id, name: `fam ${label}`, createdById: admin.id },
  })
  const userFamily = await raw.userFamily.create({
    data: { userId: parent.id, familyId: family.id, schoolId: school.id },
  })
  const person = await raw.person.create({
    data: { schoolId: school.id, name: 'Kid', lastname: label, sex: 'MALE' },
  })
  const familyPerson = await raw.familyPerson.create({
    data: {
      familyId: family.id,
      personId: person.id,
      schoolId: school.id,
      relationType: 'PARENT',
    },
  })
  const student = await raw.student.create({
    data: { schoolId: school.id, personId: person.id, birthday: new Date('2015-01-01') },
  })
  const phoneNumber = await raw.phoneNumber.create({
    data: { schoolId: school.id, personId: person.id, phoneNumber: '0600000000' },
  })

  const plan = await raw.plan.create({
    data: { schoolId: school.id, name: `plan ${label}`, amount: 100 },
  })
  const level = await raw.level.create({ data: { schoolId: school.id, name: `level ${label}` } })
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
  const classAssignment = await raw.classAssignment.create({
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
  const payment = await raw.payment.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      enrollmentId: enrollment.id,
      paymentTransactionId: paymentTransaction.id,
      amount: 50,
      method: 'CARD',
      reference: `ref ${label}`,
      paidAt: new Date(),
    },
  })

  return {
    school,
    admin,
    parent,
    family,
    userFamily,
    person,
    familyPerson,
    student,
    phoneNumber,
    plan,
    level,
    period,
    classPeriod,
    enrollment,
    classAssignment,
    paymentTransaction,
    payment,
  }
}

async function cleanup(fixture: Fixture) {
  const schoolId = fixture.school.id
  await raw.payment.deleteMany({ where: { schoolId } })
  await raw.paymentTransaction.deleteMany({ where: { schoolId } })
  await raw.classAssignment.deleteMany({ where: { schoolId } })
  await raw.enrollment.deleteMany({ where: { schoolId } })
  await raw.classPeriod.deleteMany({ where: { schoolId } })
  await raw.period.deleteMany({ where: { schoolId } })
  await raw.level.deleteMany({ where: { schoolId } })
  await raw.plan.deleteMany({ where: { schoolId } })
  await raw.phoneNumber.deleteMany({ where: { schoolId } })
  await raw.student.deleteMany({ where: { schoolId } })
  await raw.familyPerson.deleteMany({ where: { schoolId } })
  await raw.person.deleteMany({ where: { schoolId } })
  await raw.userFamily.deleteMany({ where: { schoolId } })
  await raw.family.deleteMany({ where: { schoolId } })
  await raw.schoolMember.deleteMany({ where: { schoolId } })
  await raw.school.delete({ where: { id: schoolId } })
  await raw.user.deleteMany({ where: { id: { in: [fixture.admin.id, fixture.parent.id] } } })
}

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('isolation inter-écoles sur base réelle', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = Date.now().toString(36)
    a = await seedSchool('a', suffix)
    b = await seedSchool('b', suffix)
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    if (b) await cleanup(b)
    if (a) await cleanup(a)
    await raw.$disconnect()
  }, 60_000)

  // Sans ce bloc, les `toBeNull()` ci-dessous passeraient aussi bien sur un
  // identifiant inexistant : il prouve que chaque filtre désigne une ligne réelle.
  describe('contrôle positif', () => {
    it('rend chaque ressource de B à une lecture portée par B', async () => {
      const schoolId = b.school.id

      await expect(
        db.family.findFirst({ where: { id: b.family.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.person.findFirst({ where: { id: b.person.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.student.findFirst({ where: { id: b.student.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.phoneNumber.findFirst({ where: { id: b.phoneNumber.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.familyPerson.findFirst({
          where: { familyId: b.family.id, personId: b.person.id, schoolId },
        })
      ).resolves.not.toBeNull()
      await expect(
        db.userFamily.findFirst({ where: { userId: b.parent.id, familyId: b.family.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.enrollment.findFirst({ where: { id: b.enrollment.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.classAssignment.findFirst({ where: { id: b.classAssignment.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.payment.findFirst({ where: { id: b.payment.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.paymentTransaction.findFirst({ where: { id: b.paymentTransaction.id, schoolId } })
      ).resolves.not.toBeNull()
    })

    it('écrit bien une ressource de B depuis B', async () => {
      const { count } = await db.family.updateMany({
        where: { id: b.family.id, schoolId: b.school.id },
        data: { name: b.family.name },
      })
      expect(count).toBe(1)
    })
  })

  describe('Family', () => {
    it('ne rend pas la famille de B à une lecture portée par A', async () => {
      const found = await db.family.findFirst({
        where: { id: b.family.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas la famille de B depuis A", async () => {
      const { count } = await db.family.updateMany({
        where: { id: b.family.id, schoolId: a.school.id },
        data: { name: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.family.findUniqueOrThrow({ where: { id: b.family.id } })
      expect(intact.name).toBe(b.family.name)
    })
  })

  describe('Person', () => {
    it('ne rend pas la personne de B', async () => {
      const found = await db.person.findFirst({
        where: { id: b.person.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas la personne de B depuis A", async () => {
      const { count } = await db.person.updateMany({
        where: { id: b.person.id, schoolId: a.school.id },
        data: { name: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.person.findUniqueOrThrow({ where: { id: b.person.id } })
      expect(intact.name).toBe(b.person.name)
    })
  })

  describe('Student', () => {
    it("ne rend pas l'élève de B", async () => {
      const found = await db.student.findFirst({
        where: { id: b.student.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas l'élève de B depuis A", async () => {
      const { count } = await db.student.updateMany({
        where: { id: b.student.id, schoolId: a.school.id },
        data: { birthplace: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.student.findUniqueOrThrow({ where: { id: b.student.id } })
      expect(intact.birthplace).toBeNull()
    })
  })

  describe('PhoneNumber', () => {
    it('ne rend pas le téléphone de B', async () => {
      const found = await db.phoneNumber.findFirst({
        where: { id: b.phoneNumber.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le téléphone de B depuis A", async () => {
      const { count } = await db.phoneNumber.updateMany({
        where: { id: b.phoneNumber.id, schoolId: a.school.id },
        data: { phoneNumber: '0699999999' },
      })
      expect(count).toBe(0)

      const intact = await raw.phoneNumber.findUniqueOrThrow({ where: { id: b.phoneNumber.id } })
      expect(intact.phoneNumber).toBe(b.phoneNumber.phoneNumber)
    })
  })

  describe('FamilyPerson', () => {
    it('ne rend pas le rattachement de B', async () => {
      const found = await db.familyPerson.findFirst({
        where: { familyId: b.family.id, personId: b.person.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le rattachement de B depuis A", async () => {
      const { count } = await db.familyPerson.updateMany({
        where: { familyId: b.family.id, personId: b.person.id, schoolId: a.school.id },
        data: { relationType: 'OTHER' },
      })
      expect(count).toBe(0)

      const intact = await raw.familyPerson.findFirstOrThrow({
        where: { familyId: b.family.id, personId: b.person.id },
      })
      expect(intact.relationType).toBe('PARENT')
    })
  })

  describe('UserFamily', () => {
    it('ne rend pas le lien compte-famille de B', async () => {
      const found = await db.userFamily.findFirst({
        where: { userId: b.parent.id, familyId: b.family.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it('ne supprime pas le lien compte-famille de B depuis A', async () => {
      const { count } = await db.userFamily.deleteMany({
        where: { userId: b.parent.id, familyId: b.family.id, schoolId: a.school.id },
      })
      expect(count).toBe(0)

      const intact = await raw.userFamily.count({
        where: { userId: b.parent.id, familyId: b.family.id },
      })
      expect(intact).toBe(1)
    })
  })

  describe('Enrollment', () => {
    it("ne rend pas l'inscription de B", async () => {
      const found = await db.enrollment.findFirst({
        where: { id: b.enrollment.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas l'inscription de B depuis A", async () => {
      const { count } = await db.enrollment.updateMany({
        where: { id: b.enrollment.id, schoolId: a.school.id },
        data: { status: 'CANCELLED' },
      })
      expect(count).toBe(0)

      const intact = await raw.enrollment.findUniqueOrThrow({ where: { id: b.enrollment.id } })
      expect(intact.status).toBe('ACTIVE')
    })
  })

  describe('ClassAssignment', () => {
    it("ne rend pas l'affectation de classe de B", async () => {
      const found = await db.classAssignment.findFirst({
        where: { id: b.classAssignment.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas l'affectation de classe de B depuis A", async () => {
      const { count } = await db.classAssignment.updateMany({
        where: { id: b.classAssignment.id, schoolId: a.school.id },
        data: { endAt: new Date() },
      })
      expect(count).toBe(0)

      const intact = await raw.classAssignment.findUniqueOrThrow({
        where: { id: b.classAssignment.id },
      })
      expect(intact.endAt).toBeNull()
    })
  })

  describe('Payment', () => {
    it('ne rend pas le paiement de B', async () => {
      const found = await db.payment.findFirst({
        where: { id: b.payment.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le paiement de B depuis A", async () => {
      const { count } = await db.payment.updateMany({
        where: { id: b.payment.id, schoolId: a.school.id },
        data: { reference: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.payment.findUniqueOrThrow({ where: { id: b.payment.id } })
      expect(intact.reference).toBe(b.payment.reference)
    })
  })

  describe('PaymentTransaction', () => {
    it('ne rend pas la transaction de B', async () => {
      const found = await db.paymentTransaction.findFirst({
        where: { id: b.paymentTransaction.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas la transaction de B depuis A", async () => {
      const { count } = await db.paymentTransaction.updateMany({
        where: { id: b.paymentTransaction.id, schoolId: a.school.id },
        data: { status: 'REFUNDED' },
      })
      expect(count).toBe(0)

      const intact = await raw.paymentTransaction.findUniqueOrThrow({
        where: { id: b.paymentTransaction.id },
      })
      expect(intact.status).toBe('PENDING')
    })
  })

  describe('résolution de lien profond', () => {
    it('ne voit pas B quand seule A est autorisée', async () => {
      const found = await db.family.findFirst({
        where: { id: b.family.id, schoolId: { in: [a.school.id] } },
      })
      expect(found).toBeNull()
    })

    it('voit B quand A et B sont autorisées, et rend son école', async () => {
      const found = await db.family.findFirst({
        where: { id: b.family.id, schoolId: { in: [a.school.id, b.school.id] } },
      })
      expect(found?.schoolId).toBe(b.school.id)
    })

    it("n'ouvre une ressource que sur une capacité réelle", async () => {
      const found = await db.family.findFirst({
        where: {
          id: b.family.id,
          schoolId: { in: [a.school.id, b.school.id] },
          OR: [{ schoolId: { in: [a.school.id] } }, { users: { some: { userId: a.parent.id } } }],
        },
      })
      expect(found).toBeNull()
    })
  })

  describe('garde tenant', () => {
    it('rejette une lecture non scopée en mode throw', async () => {
      const previous = process.env.TENANT_GUARD_MODE
      process.env.TENANT_GUARD_MODE = 'throw'
      try {
        await expect(db.family.findFirst({ where: { id: b.family.id } })).rejects.toBeInstanceOf(
          TenantScopeError
        )
      } finally {
        process.env.TENANT_GUARD_MODE = previous
      }
    })

    it('accepte la forme `in` utilisée par les liens profonds', async () => {
      const previous = process.env.TENANT_GUARD_MODE
      process.env.TENANT_GUARD_MODE = 'throw'
      try {
        await expect(
          db.family.findFirst({ where: { id: a.family.id, schoolId: { in: [a.school.id] } } })
        ).resolves.not.toBeNull()
      } finally {
        process.env.TENANT_GUARD_MODE = previous
      }
    })
  })
})
