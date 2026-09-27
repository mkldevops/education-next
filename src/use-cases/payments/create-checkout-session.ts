import type Stripe from 'stripe'
import { configGateway } from '@/gateways/config-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { getStripeClient } from '@/lib/stripe'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from './family-balance'
import { resolveCheckoutCredentials } from './stripe-settings'

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

  // Stripe coupé par l'école ou sans identifiants lisibles : même verdict, le bouton parent
  // ne distingue pas les deux.
  const credentials = await resolveCheckoutCredentials(input.schoolId, configGw)
  if (!credentials) return 'notConfigured' as const
  const stripe = getStripeClient(credentials.secretKey)

  // Tout passe par `tx` : une seule connexion par demande. READ COMMITTED explicite : chaque
  // requête voit la session que l'ouverture précédente a validée. Si la transaction échoue après la création chez Stripe, la ligne locale disparaît
  // au rollback : la session est alors expirée pour ne jamais rester payable sans elle.
  const opened: OpenedSession = {}
  try {
    return await db.$transaction(
      async (tx) => {
        if (!(await paymentGateway.tryLockFamilyCheckout(tx, input.schoolId, input.familyId))) {
          return 'checkoutInProgress' as const
        }
        return openCheckoutSession(tx, stripe, input, opened)
      },
      { timeout: CHECKOUT_LOCK_TIMEOUT_MS, isolationLevel: 'ReadCommitted' }
    )
  } catch (error) {
    if (opened.sessionId) {
      try {
        await stripe.checkout.sessions.expire(opened.sessionId)
      } catch {
        // Déjà payée ou Stripe injoignable : l'erreur d'origine reste celle remontée.
      }
    }
    throw error
  }
}

/** Couvre plusieurs allers-retours Stripe. */
const CHECKOUT_LOCK_TIMEOUT_MS = 60_000

type OpenedSession = { sessionId?: string }

async function openCheckoutSession(
  tx: Prisma.TransactionClient,
  stripe: Stripe,
  input: Input,
  opened: OpenedSession
) {
  const balance = await getFamilyBalance(input.schoolId, input.familyId, tx)
  if (balance.remainingAmountInCents <= 0) return 'noBalance' as const

  const previous = await closePreviousCheckoutSessions(tx, stripe, input.schoolId, input.familyId)
  if (previous !== 'OK') return previous

  const transaction = await tx.paymentTransaction.create({
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
    tx.paymentTransaction.update({
      where: { id_schoolId: { id: transaction.id, schoolId: input.schoolId } },
      data,
    })

  const familyUrl = `${input.appUrl}/${input.locale}/dashboard/families/${input.familyId}`

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(
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
          schoolId: input.schoolId,
        },
        success_url: `${familyUrl}?payment=success`,
        cancel_url: `${familyUrl}?payment=cancelled`,
      },
      {
        idempotencyKey: transaction.id,
      }
    )
  } catch {
    await updateTransaction({ status: 'FAILED' })
    return 'providerError' as const
  }
  opened.sessionId = session.id

  if (!session.url) {
    await updateTransaction({ status: 'FAILED' })
    return 'providerError' as const
  }

  await updateTransaction({ providerSessionId: session.id })

  return { result: 'OK' as const, url: session.url }
}

/**
 * Une famille n'a jamais deux sessions Checkout payables en même temps : chaque session payée
 * encaisse le solde entier, donc une seconde ferait payer deux fois. Avant d'en ouvrir une, les
 * transactions `PENDING` de la famille sont closes : une session encore ouverte est expirée chez
 * Stripe, une session déjà terminée signale un paiement dont le webhook n'est pas encore arrivé.
 */
async function closePreviousCheckoutSessions(
  tx: Prisma.TransactionClient,
  stripe: Stripe,
  schoolId: string,
  familyId: string
) {
  const pending = await tx.paymentTransaction.findMany({
    where: { schoolId, familyId, status: 'PENDING', providerSessionId: { not: null } },
    select: { id: true, providerSessionId: true },
  })

  for (const transaction of pending) {
    if (!transaction.providerSessionId) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(transaction.providerSessionId)
      if (session.status === 'complete') return 'paymentInProgress' as const
      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(transaction.providerSessionId)
      }
    } catch {
      // Dans le doute (session peut-être payée à l'instant), ne pas en ouvrir une seconde.
      return 'providerError' as const
    }
    await tx.paymentTransaction.update({
      where: { id_schoolId: { id: transaction.id, schoolId } },
      data: { status: 'EXPIRED' },
    })
  }

  return 'OK' as const
}
