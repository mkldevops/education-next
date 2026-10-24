import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { roundHalfUp } from '@/lib/decimal'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { cancelReceiptSchema } from './schemas'

type Input = z.infer<typeof cancelReceiptSchema>

/**
 * Annule un reçu sans l'effacer : il garde son numéro, ses lignes repas sortent du grand
 * livre et ses règlements d'écolage sont désactivés. Le motif est obligatoire.
 *
 * Verrou de la famille d'abord, comme un encaissement ou une suppression de famille, puis
 * le reçu : pris dans l'autre sens, une suppression concurrente s'interbloquerait.
 */
export async function cancelReceipt(
  input: Input,
  receiptGw = receiptGateway,
  configGw = configGateway
) {
  const parsed = cancelReceiptSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, receiptId } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  const familyId = await receiptGw.findFamilyId(schoolId, receiptId)
  if (!familyId) return 'notFound' as const

  return receiptGw.transaction(async (tx) => {
    await paymentGateway.lockFamilyForPayment(tx, schoolId, familyId)
    const receipt = await receiptGw.lockForCancel(tx, schoolId, receiptId)
    if (!receipt) return 'notFound' as const
    if (receipt.cancelledAt) return 'alreadyCancelled' as const

    const payments = await receiptGw.findActivePayments(tx, schoolId, receiptId)
    const ids = payments.map((payment) => payment.id)
    if (ids.length > 0) {
      // Même garde que l'annulation d'un règlement : un remboursement actif ne doit pas
      // dépasser ce qui resterait encaissé sur l'inscription.
      const enrollmentIds = [...new Set(payments.map((payment) => payment.enrollmentId))]
      const remaining = await paymentGateway.sumActiveByEnrollment(tx, schoolId, enrollmentIds, ids)
      if (enrollmentIds.some((id) => roundHalfUp(remaining.get(id) ?? 0) < 0)) {
        return 'refundExceedsPaid' as const
      }
      await paymentGateway.deactivateMany(tx, schoolId, ids)
    }

    await receiptGw.markCancelled(tx, schoolId, receiptId, {
      cancelledById: parsed.data.cancelledById,
      cancelReason: parsed.data.reason,
    })
    return 'OK' as const
  })
}
