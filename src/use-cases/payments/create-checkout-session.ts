import { db } from '@/lib/db'
import { getStripeClient } from '@/lib/stripe'
import { getFamilyBalance } from './family-balance'

type Input = {
  schoolId: string
  familyId: string
  initiatedById: string
  customerEmail: string
  locale: string
  appUrl: string
}

export async function createCheckoutSession(input: Input) {
  const stripe = getStripeClient()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return 'notConfigured' as const

  const balance = await getFamilyBalance(input.schoolId, input.familyId)
  if (balance.payableAmountInCents <= 0) return 'noBalance' as const

  const transaction = await db.paymentTransaction.create({
    data: {
      schoolId: input.schoolId,
      familyId: input.familyId,
      initiatedById: input.initiatedById,
      amount: balance.payableBalance,
      currency: 'EUR',
      provider: 'STRIPE',
    },
  })

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
              unit_amount: balance.payableAmountInCents,
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
        success_url: `${input.appUrl}/${input.locale}/dashboard/families/${input.familyId}?payment=success`,
        cancel_url: `${input.appUrl}/${input.locale}/dashboard/families/${input.familyId}?payment=cancelled`,
      },
      {
        idempotencyKey: transaction.id,
      }
    )

    if (!session.url) {
      await db.paymentTransaction.update({
        where: { id_schoolId: { id: transaction.id, schoolId: input.schoolId } },
        data: { status: 'FAILED' },
      })
      return 'providerError' as const
    }

    await db.paymentTransaction.update({
      where: { id_schoolId: { id: transaction.id, schoolId: input.schoolId } },
      data: { providerSessionId: session.id },
    })

    return { result: 'OK' as const, url: session.url }
  } catch {
    await db.paymentTransaction.update({
      where: { id_schoolId: { id: transaction.id, schoolId: input.schoolId } },
      data: { status: 'FAILED' },
    })
    return 'providerError' as const
  }
}
