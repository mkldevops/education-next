import Stripe from 'stripe'

/**
 * Un client par clé secrète, pas un singleton : deux écoles peuvent régler sur deux comptes
 * Stripe distincts, et une clé remplacée ouvre un nouveau client au lieu de réutiliser
 * l'ancien.
 */
const clients = new Map<string, Stripe>()

export function getStripeClient(secretKey: string) {
  let client = clients.get(secretKey)
  if (!client) {
    client = new Stripe(secretKey)
    clients.set(secretKey, client)
  }
  return client
}

export type StripeCredentials = { secretKey: string; webhookSecret: string }

/** Repli d'instance : les deux variables, ou rien — une moitié de configuration ne sert pas. */
export function readEnvStripeCredentials(): StripeCredentials | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) return null
  return { secretKey, webhookSecret }
}
