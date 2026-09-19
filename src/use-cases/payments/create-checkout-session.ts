import { configGateway } from '@/gateways/config-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { getStripeClient } from '@/lib/stripe'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from './family-balance'

type Input = {
  schoolId: string
  familyId: string
  initiatedById: string
  customerEmail: string
  locale: string
  appUrl: string
}

export async function createCheckoutSession(input: Input, configGw = configGateway) {
  if (!(await isPaymentsEnabled(input.schoolId, configGw))) return 'paymentsDisabled' as const

  const stripe = getStripeClient()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return 'notConfigured' as const

  const balance = await getFamilyBalance(input.schoolId, input.familyId)
  if (balance.remainingAmountInCents <= 0) return 'noBalance' as const

  const transaction = await db.paymentTransaction.create({
    data: {
      schoolId: input.schoolId,
      familyId: input.familyId,
      initiatedById: input.initiatedById,
      amount: balance.remainingBalance,
      currency: 'EUR',
      provider: 'STRIPE',
    },
  })

  const updateTransaction = (data: Prisma.PaymentTransactionUpdateInput) =>
    db.paymentTransaction.update({
      where: { id_schoolId: { id: transaction.id, schoolId: input.schoolId } },
      data,
    })

  const familyUrl = `${input.appUrl}/${input.locale}/dashboard/families/${input.familyId}`

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: input.customerEmail,
        client_reference_id: transaction.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: balance.remainingAmountInCents,
              product_data: {
                name: 'Frais de scolarité',
              },
            },
          },
        ],
        metadata: {
          transactionId: transaction.id,
          familyId: input.familyId,
        },
        success_url: `${familyUrl}?payment=success`,
        cancel_url: `${familyUrl}?payment=cancelled`,
      },
      {
        idempotencyKey: transaction.id,
      }
    )

    if (!session.url) {
      await updateTransaction({ status: 'FAILED' })
      return 'providerError' as const
    }

    await updateTransaction({ providerSessionId: session.id })

    return { result: 'OK' as const, url: session.url }
  } catch {
    await updateTransaction({ status: 'FAILED' })
    return 'providerError' as const
  }
}
