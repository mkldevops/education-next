import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe'
import { completeCheckoutSession } from '@/use-cases/payments/complete-checkout-session'

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

  if (result === 'OK' || result === 'duplicate') {
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: false, result }, { status: 422 })
}
