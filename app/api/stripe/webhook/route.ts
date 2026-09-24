import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe'
import { completeCheckoutSession } from '@/use-cases/payments/complete-checkout-session'

const ACKNOWLEDGED_RESULTS = new Set<string>(['OK', 'duplicate', 'unallocated', 'notPaid'])

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')

  if (!stripe || !webhookSecret || !signature) {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret)
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
  })

  // Tout ce qui est encaissé est enregistré (`OK`, ou `unallocated` tracé sur la transaction),
  // et un `notPaid` sera suivi d'`async_payment_succeeded` : un 2xx évite que Stripe rejoue en
  // boucle un événement qu'aucun rejeu ne changera.
  if (ACKNOWLEDGED_RESULTS.has(result)) {
    return NextResponse.json({ received: true, result })
  }

  return NextResponse.json({ received: false, result }, { status: 422 })
}
