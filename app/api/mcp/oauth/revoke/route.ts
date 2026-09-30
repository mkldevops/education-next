import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { revokeOAuthToken } from '@/use-cases/mcp/oauth/revoke-token'
import { oauthError, oauthJson, oauthPreflight, readOAuthBody } from '../_lib/oauth-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const isAddressRateLimited = createRateLimiter({ limit: 60, windowMs: 60 * 1000 })

/**
 * RFC 7009. Pas de garde sur le drapeau plateforme : rendre un jeton doit rester possible
 * quand le service est fermé.
 */
export async function POST(request: Request) {
  try {
    if (isAddressRateLimited(getClientIp(request))) {
      return oauthError('too_many_requests', 429)
    }

    const body = await readOAuthBody(request)
    if (!body) return oauthError('invalid_request')

    await revokeOAuthToken(body.token)

    return oauthJson({})
  } catch (error) {
    console.error('[api/mcp/oauth/revoke] unexpected error:', error)
    return oauthError('server_error', 500)
  }
}

export function OPTIONS() {
  return oauthPreflight()
}
