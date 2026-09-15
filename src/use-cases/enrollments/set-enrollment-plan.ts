import type { z } from 'zod'
import { calculateTotalAmount } from '@/domain/enrollment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { roundHalfUp } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { setEnrollmentPlanSchema } from './schemas'

type Input = z.infer<typeof setEnrollmentPlanSchema>

/**
 * Affecte une formule à une inscription ouverte et recalcule son total sur le prix
 * COURANT de la formule, remise inchangée — la même règle que `update_enrollment` côté
 * MCP (`src/use-cases/mcp/preview-update-enrollment.ts`), qui garde la remise de
 * l'inscription pour ne pas l'effacer en silence en changeant de formule.
 *
 * Sert avant tout à tarifer une inscription posée pendant une coupure des paiements
 * (FR-020), sans l'exiger : la formule cible est simplement refusée si c'est la ligne
 * réservée elle-même.
 */
export async function setEnrollmentPlan(input: Input) {
  const parsed = setEnrollmentPlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, enrollmentId, planId } = parsed.data

  const paymentsEnabled = await isPaymentsEnabled(schoolId)
  if (!paymentsEnabled) return 'paymentsDisabled' as const

  const enrollment = await enrollmentGateway.findOpenById(schoolId, enrollmentId)
  if (!enrollment) return 'notFound' as const

  const plan = await planGateway.findById(schoolId, planId)
  if (!plan) return 'notFound' as const
  if (plan.name === UNPRICED_PLAN_NAME) return 'unpricedPlan' as const

  const totalAmount = calculateTotalAmount(Number(plan.amount), Number(enrollment.discount))

  // Le solde ne descend jamais sous zéro : un total inférieur à ce qui est déjà encaissé
  // ferait disparaître un trop-perçu que personne n'a décidé de rembourser — même règle
  // que `commit_update_enrollment`.
  const paid = roundHalfUp(
    enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  )
  if (paid > totalAmount) return 'totalBelowPaid' as const

  await enrollmentGateway.assignPlan(schoolId, enrollmentId, planId, totalAmount)

  return 'OK' as const
}
