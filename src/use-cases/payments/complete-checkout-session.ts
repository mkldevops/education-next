import { distributePayment } from '@/domain/payment'
import { db } from '@/lib/db'
import { getFamilyBalance } from './family-balance'

type CheckoutSession = {
  id: string
  amount_total: number | null
  currency: string | null
  payment_status: string
  payment_intent: string | { id: string } | null
}

type Input = {
  providerEventId: string
  eventType: string
  session: CheckoutSession
}

export async function completeCheckoutSession(input: Input) {
  const existingEvent = await db.paymentProviderEvent.findUnique({
    where: { providerEventId: input.providerEventId },
  })
  if (existingEvent) return 'duplicate' as const

  if (input.session.payment_status !== 'paid') return 'notPaid' as const

  const transaction = await db.paymentTransaction.findUnique({
    where: { providerSessionId: input.session.id },
  })
  if (!transaction) return 'notFound' as const
  if (transaction.status === 'SUCCEEDED') return 'duplicate' as const

  const expectedAmount = Math.round(Number(transaction.amount) * 100)
  if (input.session.amount_total !== expectedAmount) return 'amountMismatch' as const
  if (input.session.currency?.toUpperCase() !== transaction.currency) {
    return 'currencyMismatch' as const
  }

  const balance = await getFamilyBalance(transaction.familyId)
  const distribution = distributePayment(
    Number(transaction.amount),
    balance.payableEnrollments.map((enrollment) => ({
      enrollmentId: enrollment.enrollmentId,
      totalAmount: enrollment.totalAmount,
      discount: enrollment.discount,
      remainingBalance: enrollment.remainingBalance,
    }))
  )
  if (distribution.result !== 'OK') return distribution.result

  const paidAt = new Date()
  const providerPaymentId =
    typeof input.session.payment_intent === 'string'
      ? input.session.payment_intent
      : input.session.payment_intent?.id

  try {
    await db.$transaction(async (tx) => {
      await tx.paymentProviderEvent.create({
        data: {
          providerEventId: input.providerEventId,
          type: input.eventType,
          paymentTransactionId: transaction.id,
        },
      })
      await tx.payment.createMany({
        data: distribution.distribution.map((allocation) => ({
          familyId: transaction.familyId,
          enrollmentId: allocation.enrollmentId,
          paymentTransactionId: transaction.id,
          amount: allocation.amount,
          method: 'STRIPE',
          reference: input.session.id,
          paidAt,
          cashedAt: paidAt,
        })),
      })
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId,
          succeededAt: paidAt,
        },
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return 'duplicate' as const
    throw error
  }

  return 'OK' as const
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}
