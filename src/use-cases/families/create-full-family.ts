import type { z } from 'zod'
import { NEW_ENROLLMENT_STATUS } from '@/domain/enrollment'
import { validateFamilyName } from '@/domain/family'
import { validateStudentBirthday } from '@/domain/student'
import { reserveClassSeatsInOrder } from '@/gateways/class-seat-lock'
import { planGateway } from '@/gateways/plan-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { resolveEnrollmentPricing } from '@/use-cases/enrollments/pricing'
import { createFullFamilySchema } from './create-full-family-schema'

type Input = z.input<typeof createFullFamilySchema> & { createdById: string }

/**
 * Crée la famille, ses responsables, ses enfants et leurs inscriptions en un seul geste.
 *
 * Une seule `db.$transaction` avec des appels `tx.*` directs : enchaîner `createFamily` puis
 * `createEnrolledStudent` laisserait une famille orpheline au premier refus — une classe pleine
 * suffirait. Tous les refus attendus (`notFound`, `classFull`, tarif) sortent avant la première
 * écriture ; une exception inattendue annule le reste. Précédents : `create-enrolled-student.ts`
 * et `commit-enroll-family.ts`.
 *
 * Sans enfant ni responsable, le résultat est celui de l'ancien formulaire « nom seul ».
 */
export async function createFullFamily(input: Input) {
  const parsed = createFullFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const nameCheck = validateFamilyName(parsed.data.name)
  if (nameCheck !== 'OK') return nameCheck

  const { parents, address, postCode, city, schoolId, students, ...familyData } = parsed.data

  for (const { student } of students) {
    if (!student.birthday) continue
    const birthdayCheck = validateStudentBirthday(student.birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  const enrollments = students.flatMap(({ enrollment }) => (enrollment ? [enrollment] : []))
  const paymentsEnabled = enrollments.length > 0 ? await isPaymentsEnabled(schoolId) : false

  // Mêmes gardes que `createEnrolledStudent` (FR-017) : formule obligatoire drapeau actif,
  // ni formule ni remise pendant une coupure des paiements.
  for (const enrollment of enrollments) {
    if (paymentsEnabled && enrollment.planId === undefined) return 'validationError' as const
    if (!paymentsEnabled && (enrollment.planId !== undefined || enrollment.discount !== 0)) {
      return 'paymentsDisabled' as const
    }
  }

  return db.$transaction(async (tx) => {
    // Une relecture par formule visée, avant toute écriture.
    const planAmounts = new Map<string, number>()
    for (const { planId } of enrollments) {
      if (!planId || planAmounts.has(planId)) continue
      const plan = await tx.plan.findFirst({
        where: { id: planId, schoolId, isActive: true },
        select: { amount: true },
      })
      if (!plan) return 'notFound' as const
      planAmounts.set(planId, Number(plan.amount))
    }

    // Une réservation par classe visée : deux enfants dans la même classe y prennent deux places.
    const seatsByClass = new Map<string, number>()
    for (const { classPeriodId } of enrollments) {
      seatsByClass.set(classPeriodId, (seatsByClass.get(classPeriodId) ?? 0) + 1)
    }
    const seats = await reserveClassSeatsInOrder(tx, schoolId, seatsByClass)
    if (seats !== 'OK') return seats

    const pricings: Array<{ discount: number; totalAmount: number } | null> = []
    for (const { enrollment } of students) {
      if (!enrollment) {
        pricings.push(null)
        continue
      }
      // Hors drapeau : formule réservée de montant nul, remise déjà refusée non nulle.
      const planAmount = enrollment.planId ? planAmounts.get(enrollment.planId) : undefined
      if (planAmount === undefined) {
        pricings.push({ discount: 0, totalAmount: 0 })
        continue
      }
      const pricing = resolveEnrollmentPricing(
        planAmount,
        enrollment.discount,
        enrollment.totalAmount
      )
      if (typeof pricing === 'string') return pricing
      pricings.push(pricing)
    }

    const family = await tx.family.create({
      data: { ...familyData, schoolId, createdById: input.createdById },
      select: { id: true },
    })

    // Les créations imbriquées ne répètent pas `schoolId` : Prisma le remplit depuis la personne
    // parente et le refuse en argument. Précédent : `familyGateway.createWithParents`.
    for (const { phoneNumber, ...person } of parents) {
      await tx.person.create({
        data: {
          ...person,
          address,
          postCode,
          city,
          schoolId,
          families: { create: { familyId: family.id, relationType: 'PARENT' } },
          ...(phoneNumber ? { phoneNumbers: { create: { phoneNumber, channels: [] } } } : {}),
        },
        select: { id: true },
      })
    }

    // Formule réservée résolue au premier enfant inscrit hors drapeau, dans la transaction.
    let unpricedPlanId: string | undefined

    const studentIds: string[] = []
    const enrollmentIds: string[] = []
    for (const [index, { person, student, enrollment }] of students.entries()) {
      const createdPerson = await tx.person.create({
        data: {
          ...person,
          schoolId,
          families: { create: { familyId: family.id, relationType: 'OTHER' } },
        },
        select: { id: true },
      })
      const createdStudent = await tx.student.create({
        data: { ...student, schoolId, personId: createdPerson.id },
        select: { id: true },
      })
      studentIds.push(createdStudent.id)

      const pricing = pricings[index]
      if (!enrollment || !pricing) continue

      let planId = enrollment.planId
      if (!planId) {
        unpricedPlanId ??= (await planGateway.ensureUnpriced(schoolId, tx)).id
        planId = unpricedPlanId
      }

      const createdEnrollment = await tx.enrollment.create({
        data: {
          schoolId,
          studentId: createdStudent.id,
          planId,
          totalAmount: pricing.totalAmount,
          discount: pricing.discount,
          canLeaveAlone: enrollment.canLeaveAlone,
          status: NEW_ENROLLMENT_STATUS,
        },
        select: { id: true },
      })
      await tx.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: createdEnrollment.id,
          classPeriodId: enrollment.classPeriodId,
          startAt: new Date(),
        },
      })
      enrollmentIds.push(createdEnrollment.id)
    }

    return { id: family.id, studentIds, enrollmentIds }
  })
}
