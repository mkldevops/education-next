import type { z } from 'zod'
import {
  calculateTotalAmount,
  NEW_ENROLLMENT_STATUS,
  pricingFromTotalAmount,
  validateDiscount,
} from '@/domain/enrollment'
import { validateStudentBirthday } from '@/domain/student'
import { reserveClassSeats } from '@/gateways/class-seat-lock'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import { planGateway } from '@/gateways/plan-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { createEnrolledStudentSchema } from './schemas'

/**
 * `deferPricing` : l'inscription est posée sans tarif, comme pendant une coupure des
 * paiements, quel que soit le drapeau de l'école. Un enseignant à accès élargi inscrit ainsi
 * sans voir ni choisir de montant ; l'administration pose la formule ensuite (FR-020).
 */
type Input = z.input<typeof createEnrolledStudentSchema> & { deferPricing?: boolean }

/**
 * Crée l'élève et son inscription en un seul geste, pour que l'ajout d'un enfant dans une
 * famille n'oblige plus à rouvrir un second dialogue d'inscription.
 *
 * Une seule `db.$transaction` avec des appels `tx.*` directs : aucune passerelle n'accepte de
 * client injecté, et enchaîner `createStudent` puis `createEnrollment` laisserait un élève sans
 * inscription derrière le premier refus — une classe pleine suffirait. Précédents du dépôt :
 * `create-enrollment.ts` et `commit-enroll-family.ts`.
 */
export async function createEnrolledStudent(input: Input) {
  const parsed = createEnrolledStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId, person, student, enrollment } = parsed.data

  const paymentsEnabled = input.deferPricing ? false : await isPaymentsEnabled(schoolId)

  // Mêmes deux contrôles que `createEnrollment`, pour la même raison : le schéma laisse
  // `planId` facultatif pour la coupure, donc l'obligation est restaurée ici drapeau actif,
  // et une formule ou une remise explicites pendant une coupure trahissent un appelant qui
  // ignore le drapeau — les tarifer en silence est pire que refuser (FR-017).
  if (paymentsEnabled && enrollment.planId === undefined) return 'validationError' as const
  if (!paymentsEnabled && (enrollment.planId !== undefined || enrollment.discount !== 0)) {
    return 'paymentsDisabled' as const
  }

  if (student.birthday) {
    const birthdayCheck = validateStudentBirthday(student.birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  return db.$transaction(async (tx) => {
    if (!(await lockActiveFamily(tx, schoolId, familyId))) return 'notFound' as const

    // La formule n'est résolue que drapeau actif : hors drapeau, la formule réservée est
    // créée dans cette transaction, donc elle repart avec le rollback si la classe s'avère
    // pleine plus bas. Même ordre que `create-enrollment.ts`.
    const planId = paymentsEnabled ? enrollment.planId : undefined
    const plan = planId
      ? await tx.plan.findFirst({
          where: { id: planId, schoolId, isActive: true },
          select: { amount: true },
        })
      : null
    if (planId && !plan) return 'notFound' as const

    // Même réservation que `create-enrollment.ts`, avant la première écriture : la ligne de la
    // classe est verrouillée jusqu'au commit, donc deux ajouts simultanés sur la dernière place
    // ne passent pas tous les deux et aucune personne n'est créée pour rien.
    const seats = await reserveClassSeats(tx, schoolId, enrollment.classPeriodId)
    if (seats !== 'OK') return seats

    // Formule réservée de montant nul et remise déjà refusée non nulle hors drapeau
    // (FR-017) : `totalAmount` reste 0 sans repasser par `calculateTotalAmount`.
    let totalAmount = 0
    let discount = enrollment.discount
    if (plan) {
      const planAmount = Number(plan.amount)
      if (enrollment.totalAmount !== undefined) {
        const pricing = pricingFromTotalAmount(planAmount, enrollment.totalAmount)
        if (typeof pricing === 'string') return pricing
        discount = pricing.discount
        totalAmount = pricing.totalAmount
      } else {
        const discountCheck = validateDiscount(planAmount, discount)
        if (discountCheck !== 'OK') return discountCheck
        totalAmount = calculateTotalAmount(planAmount, discount)
      }
    }

    // La création imbriquée de `FamilyPerson` ne répète pas `schoolId` : Prisma le remplit
    // depuis la personne parente et le refuse en argument. Précédent : `personGateway.createWithFamily`.
    const createdPerson = await tx.person.create({
      data: {
        ...person,
        schoolId,
        families: { create: { familyId, relationType: 'OTHER' } },
      },
      select: { id: true },
    })

    const createdStudent = await tx.student.create({
      data: { ...student, schoolId, personId: createdPerson.id },
      select: { id: true },
    })

    const createdEnrollment = await tx.enrollment.create({
      data: {
        schoolId,
        studentId: createdStudent.id,
        planId: planId ?? (await planGateway.ensureUnpriced(schoolId, tx)).id,
        totalAmount,
        discount,
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

    return { studentId: createdStudent.id, enrollmentId: createdEnrollment.id }
  })
}
