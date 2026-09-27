import { readEnvStripeCredentials } from '@/lib/stripe'
import { handleStripeWebhook } from './handle-webhook'

/**
 * Point d'entrée de l'instance, vérifié par `STRIPE_WEBHOOK_SECRET`. Une école qui saisit
 * ses propres identifiants déclare `/api/stripe/webhook/{schoolId}` à la place.
 */
export async function POST(request: Request) {
  return handleStripeWebhook(request, readEnvStripeCredentials())
}
