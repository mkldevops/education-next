// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { familyGateway } from '@/gateways/family-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

/**
 * Suppression définitive d'une famille, sur une vraie base.
 *
 * Un mock ne prouverait rien ici : ce que le test vérifie, ce sont les clés étrangères
 * `Restrict` que Postgres oppose à l'ordre des suppressions, et les cascades qu'il
 * applique tout seul. Les fixtures sont écrites par un client sans garde ni
 * soft-delete ; la suppression passe par la passerelle applicative.
 */

const databaseUrl = process.env.DATABASE_URL

let raw: PrismaClient
let fixture: Awaited<ReturnType<typeof seed>>
let impact: Awaited<ReturnType<typeof familyGateway.countDeletionImpact>>

async function seed(suffix: string) {
  const school = await raw.school.create({
    data: { name: `del ${suffix}`, slug: `del-${suffix}` },
  })
  const schoolId = school.id

  const admin = await raw.user.create({ data: { email: `admin-${suffix}@del.test` } })
  const parentUser = await raw.user.create({ data: { email: `parent-${suffix}@del.test` } })
  await raw.schoolMember.createMany({
    data: [
      { userId: admin.id, schoolId, role: 'ADMIN' },
      { userId: parentUser.id, schoolId, role: 'PARENT' },
    ],
  })

  const target = await raw.family.create({
    data: { schoolId, name: 'Cible', createdById: admin.id },
  })
  const neighbour = await raw.family.create({
    data: { schoolId, name: 'Voisine', createdById: admin.id },
  })

  await raw.userFamily.create({
    data: { userId: parentUser.id, familyId: target.id, schoolId },
  })

  const plan = await raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 100 } })
  const level = await raw.level.create({ data: { schoolId, name: `level ${suffix}` } })
  const period = await raw.period.create({
    data: {
      schoolId,
      name: `period ${suffix}`,
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-06-30'),
    },
  })
  const classPeriod = await raw.classPeriod.create({
    data: {
      schoolId,
      name: `class ${suffix}`,
      capacity: 10,
      levelId: level.id,
      periodId: period.id,
    },
  })

  // Parent propre à la famille cible, archivé. `FamilyPerson` n'ayant pas d'`isActive`,
  // c'est l'élève et l'inscription archivés plus bas qui rendent `dbArchived` décisif.
  const ownParent = await raw.person.create({
    data: { schoolId, name: 'Marie', lastname: 'Cible', isActive: false },
  })
  await raw.familyPerson.create({
    data: { schoolId, familyId: target.id, personId: ownParent.id, relationType: 'PARENT' },
  })
  const ownParentPhone = await raw.phoneNumber.create({
    data: { schoolId, personId: ownParent.id, phoneNumber: '0600000001' },
  })
  const ownParentInvitation = await raw.invitation.create({
    data: {
      schoolId,
      email: `invite-parent-${suffix}@del.test`,
      token: `token-parent-${suffix}`,
      expiresAt: new Date('2027-01-01'),
      createdById: admin.id,
      familyId: target.id,
      personId: ownParent.id,
    },
  })

  const child = await raw.person.create({
    data: { schoolId, name: 'Léo', lastname: 'Cible' },
  })
  await raw.familyPerson.create({
    data: { schoolId, familyId: target.id, personId: child.id, relationType: 'SIBLING' },
  })
  // Élève archivé, portant une inscription active et une archivée. Sous `db`, ces deux
  // lectures manqueraient leur cible et laisseraient des lignes dont `Enrollment.student`
  // et `Student.person`, en `Restrict`, feraient échouer la suppression. C'est ce que
  // `dbArchived` achète, et rien d'autre ne le prouve ici.
  const student = await raw.student.create({
    data: { schoolId, personId: child.id, isActive: false },
  })
  const enrollment = await raw.enrollment.create({
    data: { schoolId, studentId: student.id, planId: plan.id, status: 'ACTIVE', totalAmount: 100 },
  })
  const archivedEnrollment = await raw.enrollment.create({
    data: {
      schoolId,
      studentId: student.id,
      planId: plan.id,
      status: 'CANCELLED',
      totalAmount: 40,
      isActive: false,
    },
  })
  const classAssignment = await raw.classAssignment.create({
    data: { schoolId, enrollmentId: enrollment.id, classPeriodId: classPeriod.id },
  })

  const transaction = await raw.paymentTransaction.create({
    data: {
      schoolId,
      familyId: target.id,
      initiatedById: parentUser.id,
      amount: 100,
      provider: 'STRIPE',
    },
  })
  const providerEvent = await raw.paymentProviderEvent.create({
    data: {
      providerEventId: `evt-${suffix}`,
      type: 'checkout.session.completed',
      paymentTransactionId: transaction.id,
    },
  })
  const payment = await raw.payment.create({
    data: {
      schoolId,
      familyId: target.id,
      enrollmentId: enrollment.id,
      paymentTransactionId: transaction.id,
      amount: 100,
      method: 'CARD',
      paidAt: new Date(),
    },
  })

  // Personne partagée entre les deux familles : son dossier appartient aussi à la
  // voisine, elle doit survivre à la suppression de la cible.
  const shared = await raw.person.create({
    data: { schoolId, name: 'Nadia', lastname: 'Partagée' },
  })
  await raw.familyPerson.createMany({
    data: [
      { schoolId, familyId: target.id, personId: shared.id, relationType: 'TUTOR' },
      { schoolId, familyId: neighbour.id, personId: shared.id, relationType: 'PARENT' },
    ],
  })
  const sharedStudent = await raw.student.create({ data: { schoolId, personId: shared.id } })
  const sharedEnrollment = await raw.enrollment.create({
    data: {
      schoolId,
      studentId: sharedStudent.id,
      planId: plan.id,
      status: 'ACTIVE',
      totalAmount: 50,
    },
  })
  const neighbourPayment = await raw.payment.create({
    data: {
      schoolId,
      familyId: neighbour.id,
      enrollmentId: sharedEnrollment.id,
      amount: 50,
      method: 'CASH',
      paidAt: new Date(),
    },
  })
  const neighbourInvitation = await raw.invitation.create({
    data: {
      schoolId,
      email: `invite-voisine-${suffix}@del.test`,
      token: `token-voisine-${suffix}`,
      expiresAt: new Date('2027-01-01'),
      createdById: admin.id,
      familyId: neighbour.id,
      personId: shared.id,
    },
  })

  // Un appel validé où l'enfant de la cible et l'élève partagé ont été pointés.
  // `AttendanceEntry.student` est `Restrict` : sans effacement explicite, la suppression
  // de l'élève échouait en P2003 dès le premier appel.
  const attendanceSession = await raw.attendanceSession.create({
    data: {
      schoolId,
      classPeriodId: classPeriod.id,
      occurrenceKey: 'adhoc',
      occurredOn: new Date('2026-09-14'),
      status: 'VALIDATED',
      validatedAt: new Date(),
      createdById: admin.id,
      updatedById: admin.id,
    },
  })
  const attendanceEntry = await raw.attendanceEntry.create({
    data: {
      schoolId,
      attendanceSessionId: attendanceSession.id,
      studentId: student.id,
      studentName: 'Léo Cible',
      status: 'PRESENT',
      updatedById: admin.id,
    },
  })
  const sharedAttendanceEntry = await raw.attendanceEntry.create({
    data: {
      schoolId,
      attendanceSessionId: attendanceSession.id,
      studentId: sharedStudent.id,
      studentName: 'Nadia Partagée',
      status: 'LATE',
      lateMinutes: 5,
      updatedById: admin.id,
    },
  })

  return {
    school,
    attendanceSession,
    attendanceEntry,
    sharedAttendanceEntry,
    admin,
    parentUser,
    target,
    neighbour,
    ownParent,
    ownParentPhone,
    ownParentInvitation,
    child,
    student,
    enrollment,
    archivedEnrollment,
    classAssignment,
    transaction,
    providerEvent,
    payment,
    shared,
    sharedStudent,
    sharedEnrollment,
    neighbourPayment,
    neighbourInvitation,
    plan,
    level,
    period,
    classPeriod,
  }
}

async function cleanup() {
  if (!fixture) return
  const schoolId = fixture.school.id
  await raw.paymentProviderEvent.deleteMany({
    where: { providerEventId: fixture.providerEvent.providerEventId },
  })
  await raw.payment.deleteMany({ where: { schoolId } })
  await raw.paymentTransaction.deleteMany({ where: { schoolId } })
  await raw.invitation.deleteMany({ where: { schoolId } })
  await raw.classAssignment.deleteMany({ where: { schoolId } })
  await raw.attendanceSession.deleteMany({ where: { schoolId } })
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
  await raw.user.deleteMany({
    where: { id: { in: [fixture.admin.id, fixture.parentUser.id] } },
  })
}

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('familyGateway.deleteWithRelated sur base réelle', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    fixture = await seed(Date.now().toString(36))
    impact = await familyGateway.countDeletionImpact(fixture.school.id, fixture.target.id)
    await familyGateway.deleteWithRelated(fixture.school.id, fixture.target.id)
  }, 60_000)

  afterAll(async () => {
    if (!raw) return
    await cleanup()
    await raw.$disconnect()
  }, 60_000)

  it('efface la famille et son rattachement de compte', async () => {
    await expect(raw.family.findUnique({ where: { id: fixture.target.id } })).resolves.toBeNull()
    await expect(
      raw.userFamily.findFirst({ where: { familyId: fixture.target.id } })
    ).resolves.toBeNull()
    await expect(
      raw.familyPerson.findFirst({ where: { familyId: fixture.target.id } })
    ).resolves.toBeNull()
  })

  it("efface ses membres propres, jusqu'aux lignes archivées et aux téléphones", async () => {
    await expect(raw.person.findUnique({ where: { id: fixture.ownParent.id } })).resolves.toBeNull()
    await expect(raw.person.findUnique({ where: { id: fixture.child.id } })).resolves.toBeNull()
    await expect(
      raw.phoneNumber.findUnique({ where: { id: fixture.ownParentPhone.id } })
    ).resolves.toBeNull()
  })

  it('efface la scolarité, que les clés étrangères Restrict refusent de cascader', async () => {
    await expect(raw.student.findUnique({ where: { id: fixture.student.id } })).resolves.toBeNull()
    await expect(
      raw.enrollment.findUnique({ where: { id: fixture.enrollment.id } })
    ).resolves.toBeNull()
    await expect(
      raw.classAssignment.findUnique({ where: { id: fixture.classAssignment.id } })
    ).resolves.toBeNull()
  })

  it("compte l'impact sur le même ensemble que la suppression, archives comprises", () => {
    // 2 personnes propres sur 3 rattachées — la partagée survit ; 1 élève archivé ;
    // ses 2 inscriptions, dont une archivée ; le règlement de la famille ; sa présence,
    // et non celle de l'élève partagé.
    expect(impact).toEqual({
      members: 2,
      students: 1,
      enrollments: 2,
      payments: 1,
      attendances: 1,
    })
  })

  it("efface les présences de l'élève, même sur un appel validé, et garde la séance", async () => {
    await expect(
      raw.attendanceEntry.findUnique({ where: { id: fixture.attendanceEntry.id } })
    ).resolves.toBeNull()
    await expect(
      raw.attendanceSession.findUnique({ where: { id: fixture.attendanceSession.id } })
    ).resolves.toMatchObject({ status: 'VALIDATED' })
    await expect(
      raw.attendanceEntry.findUnique({ where: { id: fixture.sharedAttendanceEntry.id } })
    ).resolves.not.toBeNull()
  })

  it("efface l'inscription archivée, que la page ne montre pas", async () => {
    await expect(
      raw.enrollment.findUnique({ where: { id: fixture.archivedEnrollment.id } })
    ).resolves.toBeNull()
  })

  it('efface règlements, transactions et invitations, et détache le journal fournisseur', async () => {
    await expect(raw.payment.findUnique({ where: { id: fixture.payment.id } })).resolves.toBeNull()
    await expect(
      raw.paymentTransaction.findUnique({ where: { id: fixture.transaction.id } })
    ).resolves.toBeNull()
    await expect(
      raw.invitation.findUnique({ where: { id: fixture.ownParentInvitation.id } })
    ).resolves.toBeNull()
    await expect(
      raw.paymentProviderEvent.findUnique({ where: { id: fixture.providerEvent.id } })
    ).resolves.toMatchObject({ paymentTransactionId: null })
  })

  it('laisse intacte la personne partagée et le dossier de la famille voisine', async () => {
    await expect(
      raw.person.findUnique({ where: { id: fixture.shared.id } })
    ).resolves.not.toBeNull()
    await expect(
      raw.student.findUnique({ where: { id: fixture.sharedStudent.id } })
    ).resolves.not.toBeNull()
    await expect(
      raw.enrollment.findUnique({ where: { id: fixture.sharedEnrollment.id } })
    ).resolves.not.toBeNull()
    await expect(
      raw.payment.findUnique({ where: { id: fixture.neighbourPayment.id } })
    ).resolves.not.toBeNull()
    await expect(
      raw.familyPerson.findFirst({
        where: { familyId: fixture.neighbour.id, personId: fixture.shared.id },
      })
    ).resolves.not.toBeNull()
    await expect(
      raw.invitation.findUnique({ where: { id: fixture.neighbourInvitation.id } })
    ).resolves.not.toBeNull()
  })

  it('ne laisse pas la personne partagée rattachée à la famille supprimée', async () => {
    await expect(
      raw.familyPerson.findFirst({
        where: { familyId: fixture.target.id, personId: fixture.shared.id },
      })
    ).resolves.toBeNull()
  })
})
