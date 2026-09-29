import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { registerOAuthClient } from '@/use-cases/mcp/oauth/register-client'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { oauthError, oauthJson, oauthPreflight, readOAuthJson } from '../_lib/oauth-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Chaque enregistrement crée une ligne : l'étage par adresse est le seul frein, et il
 * est serré. ChatGPT n'enregistre qu'une fois par connecteur.
 */
const isAddressRateLimited = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })

/** RFC 7591 : enregistrement dynamique, anonyme, d'un client public. */
export async function POST(request: Request) {
  try {
    if (isAddressRateLimited(getClientIp(request))) {
      return oauthError('too_many_requests', 429)
    }
    if (!(await isMcpEnabled())) return oauthError('temporarily_unavailable', 503)

    const result = await registerOAuthClient(await readOAuthJson(request))
    if (result === 'invalidClientMetadata') return oauthError('invalid_client_metadata')

    return oauthJson(result, 201)
  } catch (error) {
    console.error('[api/mcp/oauth/register] unexpected error:', error)
    return oauthError('server_error', 500)
  }
}

export function OPTIONS() {
  return oauthPreflight()
}
