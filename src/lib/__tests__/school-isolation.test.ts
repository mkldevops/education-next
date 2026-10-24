// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient, db } from '@/lib/db'
import { TenantScopeError } from '@/lib/tenant-guard'
import { getPlatformSetting } from '@/use-cases/platform-settings/get-platform-setting'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'

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
      { userId: admin.id, schoolId: school.id, roles: ['ADMIN'] },
      { userId: parent.id, schoolId: school.id, roles: ['PARENT'] },
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
  const teacher = await raw.teacher.create({
    data: {
      schoolId: school.id,
      firstName: `teacher ${label}`,
      lastName: 'Iso',
    },
  })
  const classPeriodTeacher = await raw.classPeriodTeacher.create({
    data: { schoolId: school.id, classPeriodId: classPeriod.id, teacherId: teacher.id },
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
  const teacherExpense = await raw.teacherExpense.create({
    data: {
      schoolId: school.id,
      teacherId: teacher.id,
      amount: 25,
      category: 'Goûter',
      description: `goûter ${label}`,
      requestedAt: new Date('2026-09-15'),
    },
  })

  const mealServiceSetting = await raw.mealServiceSetting.create({
    data: { schoolId: school.id, service: 'CANTEEN', allowedWeekdays: [1, 2, 3, 4] },
  })

  const mealPrice = await raw.mealPrice.create({
    data: {
      schoolId: school.id,
      service: 'CANTEEN',
      amount: 750,
      effectiveFrom: new Date('2026-09-01'),
    },
  })

  const mealAccount = await raw.mealAccount.create({
    data: { schoolId: school.id, studentId: student.id, service: 'CANTEEN' },
  })
  const mealSchedule = await raw.mealSchedule.create({
    data: {
      schoolId: school.id,
      accountId: mealAccount.id,
      periodId: period.id,
      weekdays: [1, 2],
      startOn: new Date('2026-09-01'),
    },
  })
  const mealAdjustment = await raw.mealAdjustment.create({
    data: {
      schoolId: school.id,
      accountId: mealAccount.id,
      kind: 'OPENING',
      days: 5,
      reason: `reprise ${label}`,
      recordedById: admin.id,
    },
  })
  const receipt = await raw.receipt.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      number: 1,
      total: 1500,
      method: 'CASH',
      paidAt: new Date(),
      recordedById: admin.id,
      idempotencyKey: `key-${label}`,
      requestHash: `hash-${label}`,
    },
  })
  const mealPayment = await raw.mealPayment.create({
    data: {
      schoolId: school.id,
      receiptId: receipt.id,
      accountId: mealAccount.id,
      amount: 1500,
      unitPrice: 750,
      daysAdded: 2,
      creditAtReceipt: 0,
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
    teacher,
    classPeriodTeacher,
    enrollment,
    classAssignment,
    paymentTransaction,
    payment,
    teacherExpense,
    mealServiceSetting,
    mealPrice,
    mealAccount,
    mealSchedule,
    mealAdjustment,
    receipt,
    mealPayment,
  }
}

async function cleanup(fixture: Fixture) {
  const schoolId = fixture.school.id
  await raw.payment.deleteMany({ where: { schoolId } })
  await raw.paymentTransaction.deleteMany({ where: { schoolId } })
  await raw.teacherExpense.deleteMany({ where: { schoolId } })
  await raw.mealPayment.deleteMany({ where: { schoolId } })
  await raw.receipt.deleteMany({ where: { schoolId } })
  await raw.mealAdjustment.deleteMany({ where: { schoolId } })
  await raw.mealSchedule.deleteMany({ where: { schoolId } })
  await raw.mealAccount.deleteMany({ where: { schoolId } })
  await raw.mealPrice.deleteMany({ where: { schoolId } })
  await raw.mealServiceSetting.deleteMany({ where: { schoolId } })
  await raw.classPeriodTeacher.deleteMany({ where: { schoolId } })
  await raw.classAssignment.deleteMany({ where: { schoolId } })
  await raw.enrollment.deleteMany({ where: { schoolId } })
  await raw.classPeriod.deleteMany({ where: { schoolId } })
  await raw.teacher.deleteMany({ where: { schoolId } })
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
      await expect(
        db.teacher.findFirst({ where: { id: b.teacher.id, schoolId } })
      ).resolves.not.toBeNull()
      await expect(
        db.classPeriodTeacher.findFirst({
          where: { classPeriodId: b.classPeriod.id, teacherId: b.teacher.id, schoolId },
        })
      ).resolves.not.toBeNull()
      await expect(
        db.teacherExpense.findFirst({
          where: { id: b.teacherExpense.id, schoolId },
        })
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

  describe('Teacher', () => {
    it("ne rend pas l'enseignant de B depuis A", async () => {
      const found = await db.teacher.findFirst({
        where: { id: b.teacher.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas l'enseignant de B depuis A", async () => {
      const { count } = await db.teacher.updateMany({
        where: { id: b.teacher.id, schoolId: a.school.id },
        data: { lastName: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.teacher.findUniqueOrThrow({ where: { id: b.teacher.id } })
      expect(intact.lastName).toBe(b.teacher.lastName)
    })
  })

  describe('TeacherExpense', () => {
    it('ne rend pas la note de frais de B depuis A', async () => {
      const found = await db.teacherExpense.findFirst({
        where: { id: b.teacherExpense.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas la note de frais de B depuis A", async () => {
      const { count } = await db.teacherExpense.updateMany({
        where: { id: b.teacherExpense.id, schoolId: a.school.id },
        data: { description: 'compromis' },
      })
      expect(count).toBe(0)

      const intact = await raw.teacherExpense.findUniqueOrThrow({
        where: { id: b.teacherExpense.id },
      })
      expect(intact.description).toBe(b.teacherExpense.description)
    })
  })

  describe('MealServiceSetting', () => {
    it('ne rend pas le réglage de B depuis A', async () => {
      const found = await db.mealServiceSetting.findFirst({
        where: { id: b.mealServiceSetting.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le réglage de B depuis A", async () => {
      const { count } = await db.mealServiceSetting.updateMany({
        where: { id: b.mealServiceSetting.id, schoolId: a.school.id },
        data: { isEnabled: true },
      })
      expect(count).toBe(0)

      const intact = await raw.mealServiceSetting.findUniqueOrThrow({
        where: { id: b.mealServiceSetting.id },
      })
      expect(intact.isEnabled).toBe(false)
    })
  })

  describe('MealPrice', () => {
    it('ne rend pas le tarif de B depuis A', async () => {
      const found = await db.mealPrice.findFirst({
        where: { id: b.mealPrice.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le tarif de B depuis A", async () => {
      const { count } = await db.mealPrice.updateMany({
        where: { id: b.mealPrice.id, schoolId: a.school.id },
        data: { amount: 1 },
      })
      expect(count).toBe(0)

      const intact = await raw.mealPrice.findUniqueOrThrow({ where: { id: b.mealPrice.id } })
      expect(intact.amount.toNumber()).toBe(750)
    })
  })

  describe('MealAccount', () => {
    it('ne rend pas le compte repas de B depuis A', async () => {
      const found = await db.mealAccount.findFirst({
        where: { id: b.mealAccount.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })
  })

  describe('MealSchedule', () => {
    it('ne rend pas le segment de B depuis A', async () => {
      const found = await db.mealSchedule.findFirst({
        where: { id: b.mealSchedule.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'écrit pas le segment de B depuis A", async () => {
      const { count } = await db.mealSchedule.updateMany({
        where: { id: b.mealSchedule.id, schoolId: a.school.id },
        data: { weekdays: [3] },
      })
      expect(count).toBe(0)

      const intact = await raw.mealSchedule.findUniqueOrThrow({ where: { id: b.mealSchedule.id } })
      expect(intact.weekdays).toEqual([1, 2])
    })
  })

  describe('MealAdjustment', () => {
    it("ne rend pas l'ajustement de B depuis A", async () => {
      const found = await db.mealAdjustment.findFirst({
        where: { id: b.mealAdjustment.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'efface pas l'ajustement de B depuis A", async () => {
      const { count } = await db.mealAdjustment.deleteMany({
        where: { id: b.mealAdjustment.id, schoolId: a.school.id },
      })
      expect(count).toBe(0)
    })
  })

  describe('Receipt', () => {
    it('ne rend pas le reçu de B depuis A', async () => {
      const found = await db.receipt.findFirst({
        where: { id: b.receipt.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
    })

    it("n'annule pas le reçu de B depuis A", async () => {
      const { count } = await db.receipt.updateMany({
        where: { id: b.receipt.id, schoolId: a.school.id },
        data: { cancelledAt: new Date(), cancelReason: 'intrusion' },
      })
      expect(count).toBe(0)

      const intact = await raw.receipt.findUniqueOrThrow({ where: { id: b.receipt.id } })
      expect(intact.cancelledAt).toBeNull()
    })
  })

  describe('MealPayment', () => {
    it('ne rend pas la ligne repas de B depuis A', async () => {
      const found = await db.mealPayment.findFirst({
        where: { id: b.mealPayment.id, schoolId: a.school.id },
      })
      expect(found).toBeNull()
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

  /**
   * `PlatformSetting` doit échapper au garde **par construction**, pas par convention :
   * il ne porte aucun `schoolId`, donc aucune requête ne peut le scoper. Le vérifier
   * par un grep de `TENANT_SCOPED_MODELS` ne prouverait rien de l'extension réelle ;
   * ces tests l'interrogent en mode `throw`, sur la vraie base.
   */
  describe('réglage plateforme', () => {
    const inThrowMode = async (assertions: () => Promise<void>) => {
      const previous = process.env.TENANT_GUARD_MODE
      process.env.TENANT_GUARD_MODE = 'throw'
      try {
        await assertions()
      } finally {
        process.env.TENANT_GUARD_MODE = previous
      }
    }

    it("se lit et s'écrit sans école, garde en `throw`", async () => {
      const name = `guard_probe_${Date.now().toString(36)}`

      await inThrowMode(async () => {
        await expect(db.platformSetting.findUnique({ where: { name } })).resolves.toBeNull()
        await expect(
          db.platformSetting.upsert({
            where: { name },
            create: { name, value: 'true', valueType: 'BOOLEAN' },
            update: { value: 'true' },
          })
        ).resolves.toMatchObject({ name, value: 'true' })
        await expect(db.platformSetting.findMany({ where: { name } })).resolves.toHaveLength(1)
      })

      await raw.platformSetting.deleteMany({ where: { name } })
    })

    it("vaut activé tant qu'aucune ligne n'existe, puis suit la ligne écrite", async () => {
      const name = `switch_probe_${Date.now().toString(36)}`
      // Le vrai `school_switch_enabled` n'est jamais supprimé : la base est partagée, et
      // un `finally` ne survit pas à un plantage du processus. La couture de lecture
      // laisse éprouver le même code sur une ligne jetable.
      const reading = () => getPlatformSetting({ name })

      try {
        await inThrowMode(async () => {
          await expect(isSchoolSwitchEnabled(reading)).resolves.toBe(true)

          await db.platformSetting.create({
            data: { name, value: 'false', valueType: 'BOOLEAN' },
          })
          await expect(isSchoolSwitchEnabled(reading)).resolves.toBe(false)
        })
      } finally {
        await raw.platformSetting.deleteMany({ where: { name } })
      }
    })
  })
})
