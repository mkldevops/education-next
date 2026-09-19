import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { studentGateway } from '@/gateways/student-gateway'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { resolveEnrollmentPricing } from './pricing'
import { createEnrollmentSchema } from './schemas'

type Input = z.input<typeof createEnrollmentSchema>

/**
 * Classe pleine détectée dans la transaction de remplacement.
 *
 * Un `return` laisse une transaction interactive Prisma se valider : il faut une exception pour
 * annuler l'inscription précédente déjà passée en `CANCELLED` quelques lignes plus haut.
 */
class ClassFullError extends Error {}

export async function createEnrollment(input: Input) {
  const parsed = createEnrollmentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data

  const paymentsEnabled = await isPaymentsEnabled(schoolId)

  // Le schéma rend `planId` facultatif pour laisser passer une coupure des paiements ;
  // drapeau actif, l'obligation que `z.string().uuid()` portait seule auparavant est
  // restaurée ici, au même point du flux que l'échec de schéma qu'elle remplace.
  if (paymentsEnabled && parsed.data.planId === undefined) return 'validationError' as const

  // Une formule explicite ou une remise non nulle pendant une coupure trahit un appelant
  // qui ignore le drapeau : refuser plutôt que tarifer en silence une école qui a coupé
  // les paiements (FR-017).
  if (!paymentsEnabled && (parsed.data.planId !== undefined || parsed.data.discount !== 0)) {
    return 'paymentsDisabled' as const
  }

  const student = await studentGateway.findById(schoolId, parsed.data.studentId)
  if (!student) return 'notFound' as const

  // `null` sans `planId`, ce qui n'arrive que hors drapeau (voir les gardes ci-dessus) : la
  // formule réservée n'est résolue que dans la transaction plus bas, pour repartir avec le
  // rollback si la classe s'avère pleine (`ensureUnpriced` ne doit pas laisser une ligne
  // orpheline sans inscription qui la justifie).
  const { planId: requestedPlanId } = parsed.data
  const plan =
    requestedPlanId !== undefined ? await planGateway.findById(schoolId, requestedPlanId) : null
  if (paymentsEnabled && !plan) return 'notFound' as const

  const classPeriod = await classPeriodGateway.findById(schoolId, parsed.data.classPeriodId)
  if (!classPeriod) return 'notFound' as const

  // La formule réservée est de montant nul, et la remise a déjà été refusée non nulle
  // plus haut hors drapeau (FR-017) : `discount` et `totalAmount` restent 0 sans repasser
  // par `resolveEnrollmentPricing`. `if (plan)` narrowe proprement sans assertion : `plan`
  // n'est non nul qu'après le contrôle `notFound` ci-dessus, drapeau actif.
  let discount = 0
  let totalAmount = 0
  if (plan) {
    const pricing = resolveEnrollmentPricing(
      Number(plan.amount),
      parsed.data.discount ?? 0,
      parsed.data.totalAmount
    )
    if (typeof pricing === 'string') return pricing
    ;({ discount, totalAmount } = pricing)
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Garde de doublon lue sous verrou, avant toute écriture : les refus ci-dessous valident
      // une transaction vide, et une inscription concurrente attend la fin de celle-ci (#316).
      await enrollmentGateway.lockStudentInPeriod(
        tx,
        schoolId,
        parsed.data.studentId,
        classPeriod.periodId
      )
      const existing = await enrollmentGateway.findActiveInPeriod(
        tx,
        schoolId,
        parsed.data.studentId,
        classPeriod.periodId
      )
      if (existing && !parsed.data.replaceExisting) return 'duplicateEnrollment' as const
      if (existing && existing._count.payments > 0) return 'existingEnrollmentPaid' as const

      // Résolue ici plutôt qu'avant l'ouverture de la transaction : une création (première
      // coupure de l'école) repart avec le rollback si la classe s'avère pleine plus bas.
      const planId = plan ? plan.id : (await planGateway.ensureUnpriced(schoolId, tx)).id

      if (existing) {
        await tx.classAssignment.updateMany({
          where: { schoolId, enrollmentId: existing.id, endAt: null },
          data: { endAt: new Date() },
        })
        await tx.enrollment.update({
          where: { id_schoolId: { id: existing.id, schoolId } },
          data: { status: 'CANCELLED' },
        })
      }

      const enrolledCount = await tx.classAssignment.count({
        where: {
          schoolId,
          classPeriodId: parsed.data.classPeriodId,
          endAt: null,
          enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
        },
      })

      const capacityCheck = checkCapacity(classPeriod.capacity, enrolledCount)
      if (capacityCheck !== 'OK') throw new ClassFullError(capacityCheck)

      const enrollment = await tx.enrollment.create({
        data: {
          schoolId,
          studentId: parsed.data.studentId,
          planId,
          totalAmount,
          discount,
          canLeaveAlone: parsed.data.canLeaveAlone,
        },
      })

      await tx.classAssignment.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classPeriodId: parsed.data.classPeriodId,
          startAt: new Date(),
        },
      })

      return enrollment
    })

    return result
  } catch (error) {
    if (error instanceof ClassFullError) return 'classFull' as const
    throw error
  }
}
