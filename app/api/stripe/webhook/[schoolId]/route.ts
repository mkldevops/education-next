import { z } from 'zod'
import { resolveStripeCredentials } from '@/use-cases/payments/stripe-settings'
import { handleStripeWebhook } from '../handle-webhook'

const schoolIdSchema = z.uuid()

/**
 * L'école vient de l'URL, jamais du corps : le corps n'est pas authentifié avant la
 * vérification, et c'est le secret de cette école qui la fait. Une école inconnue ou sans
 * identifiants n'a aucun secret, donc la signature est refusée.
 */
export async function POST(request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await context.params
  const parsed = schoolIdSchema.safeParse(schoolId)
  const credentials = parsed.success ? await resolveStripeCredentials(parsed.data) : null

  return handleStripeWebhook(request, credentials, parsed.success ? parsed.data : undefined)
}
