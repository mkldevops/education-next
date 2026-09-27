import type { z } from 'zod'
import { paymentGateway } from '@/gateways/payment-gateway'
import { db } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import type { DraftScope } from './draft-scope'
import { mcpCancelPaymentsSchema } from './schemas'

type Input = z.infer<typeof mcpCancelPaymentsSchema>

/**
 * Annule des encaissements saisis à la main en les désactivant ; le solde de la famille
 * remonte d'autant.
 *
 * Tout ou rien, et une seule famille par appel, sous son verrou d'encaissement : un
 * brouillon calculé sur l'ancien solde devient `staleDraft` au lieu d'être engagé. Un
 * paiement en ligne n'est pas annulable ici — l'argent a réellement été prélevé, son
 * remboursement se fait chez le prestataire.
 */
export async function cancelPaymentsFromMcp(scope: DraftScope, input: Input) {
  const parsed = mcpCancelPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope
  const ids = [...new Set(parsed.data.paymentIds)]

  return db.$transaction(async (tx) => {
    const payments = await paymentGateway.findActiveByIds(tx, schoolId, ids)
    if (payments.length !== ids.length) return 'notFound' as const
    if (payments.some((payment) => payment.paymentTransactionId !== null)) {
      return 'onlinePayment' as const
    }
    const familyIds = new Set(payments.map((payment) => payment.familyId))
    if (familyIds.size !== 1) return 'mixedFamilies' as const
    const [familyId] = familyIds

    if (!(await paymentGateway.lockFamilyForPayment(tx, schoolId, familyId))) {
      return 'notFound' as const
    }
    // Relu sous le verrou : une annulation concurrente a pu passer entre-temps.
    const locked = await paymentGateway.findActiveByIds(tx, schoolId, ids)
    if (locked.length !== ids.length) return 'notFound' as const
    await paymentGateway.deactivateMany(tx, schoolId, ids)

    return {
      familyId,
      cancelledPaymentIds: ids,
      amount: roundHalfUp(payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)),
    }
  })
}
