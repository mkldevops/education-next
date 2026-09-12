import { createMcpHandler } from '@modelcontextprotocol/server'
import { after, NextResponse } from 'next/server'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { buildMcpServer } from '@/mcp/server'
import { purgeExpiredDrafts } from '@/use-cases/mcp/purge-expired-drafts'
import { resolveMcpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { scopeFromAuthInfo, toAuthInfo } from './_lib/auth-info'
import { readMcpCredential } from './_lib/credential'
import { withoutCredentials } from './_lib/forwarded-request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Deux étages, parce qu'ils ne mesurent pas la même chose.
 *
 * Claude atteint ce serveur depuis l'infrastructure d'Anthropic, pas depuis le poste de
 * l'utilisateur : `x-forwarded-for` ne désigne qu'une poignée d'adresses de sortie
 * partagées. L'étage IP n'amortit donc que le flot non authentifié ; le vrai budget est
 * celui de la clé, donc d'un utilisateur sur une école, et il ne peut être appliqué
 * qu'après la résolution de portée.
 */
const isIpRateLimited = createRateLimiter({ limit: 120, windowMs: 60 * 1000 })
const isKeyRateLimited = createRateLimiter({ limit: 600, windowMs: 60 * 1000 })

const LAST_USED_STALE_MS = 60 * 1000

const handler = createMcpHandler(({ authInfo }) => buildMcpServer(scopeFromAuthInfo(authInfo)), {
  responseMode: 'json',
})

function denied(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

/**
 * `POST` seul, et aucune lecture de cookie.
 *
 * Cette route n'appelle jamais `auth.api.getSession()` : elle ne porte donc aucune
 * autorité ambiante, et un navigateur ne peut pas poser d'en-tête `Authorization` en
 * cross-origin. La CSRF est impossible par construction, pas par validation d'`Origin`.
 */
export async function POST(request: Request) {
  try {
    if (isIpRateLimited(getClientIp(request))) return denied('tooManyRequests', 429)

    const now = new Date()

    // Avant le drapeau : la rétention ne dépend pas de l'ouverture du service. Fermer le MCP
    // arrêterait sinon le balayage tout en laissant expirer des données personnelles.
    after(() => purgeExpiredDrafts(now))

    if (!(await isMcpEnabled())) return denied('mcpDisabled', 503)

    const result = await resolveMcpScope(readMcpCredential(request.headers))
    if (result.status === 'unauthenticated') return denied('unauthorized', 401)
    if (result.status === 'forbidden') return denied('forbidden', 403)

    const { scope } = result
    if (isKeyRateLimited(scope.keyId)) return denied('tooManyRequests', 429)

    after(() =>
      mcpApiKeyGateway.touch(scope.keyId, now, new Date(now.getTime() - LAST_USED_STALE_MS))
    )

    return await handler.fetch(withoutCredentials(request), { authInfo: toAuthInfo(scope) })
  } catch (error) {
    console.error('[api/mcp] unexpected error:', error)
    return denied('serverError', 500)
  }
}

export function GET() {
  return denied('methodNotAllowed', 405)
}

export function DELETE() {
  return denied('methodNotAllowed', 405)
}
