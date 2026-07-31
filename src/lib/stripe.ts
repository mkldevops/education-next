import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null

  stripeClient ??= new Stripe(secretKey)
  return stripeClient
}
