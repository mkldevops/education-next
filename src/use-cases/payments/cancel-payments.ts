import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { db } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { cancelPaymentsSchema } from './schemas'

type Input = z.input<typeof cancelPaymentsSchema>

/**
 * Annule des encaissements saisis à la main en les désactivant ; le solde de la famille
 * remonte d'autant. Partagé par le tableau de bord et l'outil MCP `cancel_payments`.
 *
 * Tout ou rien, et une seule famille par appel, sous son verrou d'encaissement : un
 * brouillon calculé sur l'ancien solde devient `staleDraft` au lieu d'être engagé. Un
 * paiement en ligne n'est pas annulable ici — l'argent a réellement été prélevé, son
 * remboursement se fait chez le prestataire. Un règlement de caisse non plus : il
 * s'annule avec son reçu (`cancelReceipt`). L'annulation garde son auteur et son motif.
 */
export async function cancelPayments(input: Input, configGw = configGateway) {
  const parsed = cancelPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, cancelledById } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const
  const ids = [...new Set(parsed.data.paymentIds)]
  const cancelReason = parsed.data.reason || null

  return db.$transaction(async (tx) => {
    const payments = await paymentGateway.findActiveByIds(tx, schoolId, ids)
    if (payments.length !== ids.length) return 'notFound' as const
    if (payments.some((payment) => payment.paymentTransactionId !== null)) {
      return 'onlinePayment' as const
    }
    // Un règlement de caisse appartient à un reçu numéroté : il s'annule avec lui.
    if (payments.some((payment) => payment.receiptId !== null)) {
      return 'receiptPayment' as const
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

    // Annuler un encaissement alors qu'un remboursement reste actif rendrait l'encaissé de
    // l'inscription négatif, donc un reste dû supérieur au total et une saisie qui l'accepte.
    // Un remboursement ne dépasse jamais le payé : même règle qu'à la saisie, même refus.
    const enrollmentIds = [...new Set(locked.map((payment) => payment.enrollmentId))]
    const remaining = await paymentGateway.sumActiveByEnrollment(tx, schoolId, enrollmentIds, ids)
    if (enrollmentIds.some((enrollmentId) => roundHalfUp(remaining.get(enrollmentId) ?? 0) < 0)) {
      return 'refundExceedsPaid' as const
    }

    await paymentGateway.cancelMany(tx, schoolId, ids, { cancelledById, cancelReason })

    return {
      familyId,
      cancelledPaymentIds: ids,
      amount: roundHalfUp(payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)),
    }
  })
}
