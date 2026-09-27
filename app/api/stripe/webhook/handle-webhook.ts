import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient, type StripeCredentials } from '@/lib/stripe'
import { completeCheckoutSession } from '@/use-cases/payments/complete-checkout-session'

const ACKNOWLEDGED_RESULTS = new Set<string>(['OK', 'duplicate', 'unallocated', 'notPaid'])

/**
 * Vérifie la signature avec les identifiants résolus par la route, puis enregistre le
 * paiement. `schoolId` est fourni par la route par école : seule la transaction de cette
 * école peut être close.
 */
export async function handleStripeWebhook(
  request: Request,
  credentials: StripeCredentials | null,
  schoolId?: string
) {
  const signature = request.headers.get('stripe-signature')
  if (!credentials || !signature) {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripeClient(credentials.secretKey).webhooks.constructEvent(
      await request.text(),
      signature,
      credentials.webhookSecret
    )
  } catch {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return NextResponse.json({ received: true })
  }

  const result = await completeCheckoutSession({
    providerEventId: event.id,
    eventType: event.type,
    session: event.data.object,
    ...(schoolId ? { schoolId } : {}),
  })

  // Tout ce qui est encaissé est enregistré (`OK`, ou `unallocated` tracé sur la transaction),
  // et un `notPaid` sera suivi d'`async_payment_succeeded` : un 2xx évite que Stripe rejoue en
  // boucle un événement qu'aucun rejeu ne changera.
  if (ACKNOWLEDGED_RESULTS.has(result)) {
    return NextResponse.json({ received: true, result })
  }

  return NextResponse.json({ received: false, result }, { status: 422 })
}
