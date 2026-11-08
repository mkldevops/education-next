import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { issueTuitionReceipt } from './issue-tuition-receipt'
import { issueReceiptForPaymentsSchema } from './schemas'

type Input = z.infer<typeof issueReceiptForPaymentsSchema>

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

/**
 * Reçu émis après coup pour un règlement d'écolage saisi sans reçu : une ligne de l'historique
 * famille, c'est-à-dire ses paiements par inscription, actifs, positifs et sans reçu.
 * Relu sous le verrou de la famille : deux émissions simultanées n'en produisent qu'une.
 */
export async function issueReceiptForPayments(
  input: Input,
  receiptGw = receiptGateway,
  configGw = configGateway
) {
  const parsed = issueReceiptForPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, recordedById } = parsed.data
  const paymentIds = [...new Set(parsed.data.paymentIds)]
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const first = await receiptGw.transaction((tx) =>
    receiptGw.findPaymentsForReceipt(tx, schoolId, paymentIds.slice(0, 1))
  )
  const familyId = first[0]?.familyId
  if (!familyId) return 'notFound' as const

  try {
    return await receiptGw.transaction(async (tx) => {
      if (!(await paymentGateway.lockFamilyForPayment(tx, schoolId, familyId))) {
        return 'notFound' as const
      }
      const payments = await receiptGw.findPaymentsForReceipt(tx, schoolId, paymentIds)
      if (
        payments.length !== paymentIds.length ||
        payments.some((payment) => payment.familyId !== familyId || !payment.isActive)
      ) {
        return 'notFound' as const
      }
      if (payments.some((payment) => payment.receiptId !== null)) {
        return 'alreadyIssued' as const
      }
      if (payments.some((payment) => Number(payment.amount) <= 0)) return 'notReceivable' as const
      const [head] = payments
      const sameGroup = payments.every(
        (payment) =>
          payment.method === head.method &&
          (payment.reference ?? '') === (head.reference ?? '') &&
          payment.paidAt.getTime() === head.paidAt.getTime()
      )
      if (!sameGroup) return 'validationError' as const

      const receipt = await issueTuitionReceipt(
        tx,
        schoolId,
        {
          familyId,
          method: head.method,
          reference: head.reference,
          paidAt: head.paidAt,
          recordedById,
          idempotencyKey: `payment:${head.id}`,
          payments: payments.map((payment) => ({ id: payment.id, amount: Number(payment.amount) })),
        },
        receiptGw
      )
      return { receiptId: receipt.id }
    })
  } catch (error) {
    if (isUniqueViolation(error)) return 'alreadyIssued' as const
    throw error
  }
}
