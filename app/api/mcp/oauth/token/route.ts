import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { exchangeOAuthToken } from '@/use-cases/mcp/oauth/exchange-token'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { oauthError, oauthJson, oauthPreflight, readOAuthBody } from '../_lib/oauth-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const isAddressRateLimited = createRateLimiter({ limit: 60, windowMs: 60 * 1000 })

/** Statuts de RFC 6749 §5.2 : `invalid_client` est un `401`, le reste un `400`. */
function statusFor(error: string) {
  return error === 'invalid_client' ? 401 : 400
}

/** RFC 6749 §4.1.3 et §6 : échange d'un code ou rotation d'un jeton de rafraîchissement. */
export async function POST(request: Request) {
  try {
    if (isAddressRateLimited(getClientIp(request))) {
      return oauthError('too_many_requests', 429)
    }
    if (!(await isMcpEnabled())) return oauthError('temporarily_unavailable', 503)

    const body = await readOAuthBody(request)
    if (!body) return oauthError('invalid_request')

    const result = await exchangeOAuthToken(body)
    if (result.status !== 'OK') return oauthError(result.status, statusFor(result.status))

    return oauthJson(result.tokens)
  } catch (error) {
    console.error('[api/mcp/oauth/token] unexpected error:', error)
    return oauthError('server_error', 500)
  }
}

export function OPTIONS() {
  return oauthPreflight()
}
