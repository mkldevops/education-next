import { distributeReceivedPayment } from '@/domain/payment'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { findPaymentTransactionByProviderSessionId } from '@/lib/db-unscoped'
import { findLatestFamilyEnrollmentId, getFamilyBalance } from './family-balance'

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

  // Exception nommée : le webhook Stripe n'a ni session ni cookie, la transaction est
  // retrouvée par son identifiant de session fournisseur, hors du garde tenant.
  const transaction = await findPaymentTransactionByProviderSessionId(input.session.id)
  if (!transaction) return 'notFound' as const
  if (transaction.status === 'SUCCEEDED') return 'duplicate' as const

  const expectedAmount = Math.round(Number(transaction.amount) * 100)
  if (input.session.amount_total !== expectedAmount) return 'amountMismatch' as const
  if (input.session.currency?.toUpperCase() !== transaction.currency) {
    return 'currencyMismatch' as const
  }

  const paidAt = new Date()
  const providerPaymentId =
    typeof input.session.payment_intent === 'string'
      ? input.session.payment_intent
      : input.session.payment_intent?.id

  let allocations: Allocations
  try {
    allocations = await db.$transaction(async (tx) => {
      // Même verrou que la saisie manuelle et le brouillon MCP : le solde réparti ici ne peut
      // pas être consommé en parallèle. Une famille archivée n'est pas verrouillable, mais
      // l'argent déjà débité doit quand même être enregistré.
      await paymentGateway.lockFamilyForPayment(tx, transaction.schoolId, transaction.familyId)
      const captured = await allocateCapturedAmount(tx, transaction)

      await tx.paymentProviderEvent.create({
        data: {
          providerEventId: input.providerEventId,
          type: input.eventType,
          paymentTransactionId: transaction.id,
        },
      })
      if (captured.distribution.length > 0) {
        await tx.payment.createMany({
          data: captured.distribution.map((allocation) => ({
            schoolId: transaction.schoolId,
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
      }
      // Garde conditionnelle : deux événements distincts pour la même session (`completed` puis
      // `async_payment_succeeded`, ou un rejeu manuel) ne peuvent pas écrire deux fois.
      const closed = await tx.paymentTransaction.updateMany({
        where: {
          id: transaction.id,
          schoolId: transaction.schoolId,
          status: { not: 'SUCCEEDED' },
        },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId,
          succeededAt: paidAt,
        },
      })
      if (closed.count === 0) throw new AlreadyRecordedError()
      return captured
    })
  } catch (error) {
    if (error instanceof AlreadyRecordedError || isUniqueConstraintError(error)) {
      return 'duplicate' as const
    }
    throw error
  }

  const logContext = {
    providerEventId: input.providerEventId,
    transactionId: transaction.id,
    schoolId: transaction.schoolId,
    familyId: transaction.familyId,
    amount: transaction.amount,
  }
  if (allocations.fallback) {
    // Plus aucune inscription payable : l'argent est porté sur la dernière inscription de la
    // famille, à régulariser (remboursement ou réaffectation) par un admin.
    console.error(
      '[payments/complete-checkout-session] stripe payment recorded on a non-payable enrollment',
      { ...logContext, enrollmentId: allocations.distribution[0]?.enrollmentId }
    )
  }
  if (allocations.distribution.length === 0) {
    // Aucune inscription du tout : la transaction est quand même close `SUCCEEDED`, avec son
    // identifiant Stripe, pour que l'encaissement reste tracé et que Stripe cesse de rejouer.
    console.error(
      '[payments/complete-checkout-session] stripe payment captured without any enrollment to allocate',
      logContext
    )
  }

  return allocations.distribution.length > 0 ? ('OK' as const) : ('unallocated' as const)
}

class AlreadyRecordedError extends Error {}

type CapturedTransaction = { schoolId: string; familyId: string; amount: unknown }

type Allocations = {
  distribution: Array<{ enrollmentId: string; amount: number }>
  fallback: boolean
}

/**
 * Répartit un montant déjà débité, sans jamais le refuser : sur les inscriptions payables
 * (surplus inclus, voir `distributeReceivedPayment`), sinon en entier sur la dernière
 * inscription de la famille, sinon nulle part (liste vide).
 */
async function allocateCapturedAmount(
  tx: Prisma.TransactionClient,
  transaction: CapturedTransaction
): Promise<Allocations> {
  const amount = Number(transaction.amount)
  const balance = await getFamilyBalance(transaction.schoolId, transaction.familyId, tx)
  const distribution = distributeReceivedPayment(amount, balance.payableEnrollments)
  if (distribution.result === 'OK') {
    return { distribution: distribution.distribution, fallback: false }
  }

  const enrollmentId = await findLatestFamilyEnrollmentId(
    transaction.schoolId,
    transaction.familyId,
    tx
  )
  return {
    distribution: enrollmentId ? [{ enrollmentId, amount }] : [],
    fallback: enrollmentId !== null,
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
