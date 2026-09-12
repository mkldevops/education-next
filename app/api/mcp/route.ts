import { createMcpHandler } from '@modelcontextprotocol/server'
import { after, NextResponse } from 'next/server'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { buildMcpServer } from '@/mcp/server'
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
 * partagées, et sans l'en-tête tout le trafic retombe sur un seau unique. Une adresse
 * n'est donc pas l'identité d'un appelant mais un budget commun à toutes les écoles :
 * le facturer au trafic authentifié rendrait `429` aux clés des autres écoles dès
 * qu'une seule est active, et bornerait le budget par clé bien avant sa valeur.
 *
 * L'étage par adresse ne couvre donc que ce qu'il est censé amortir — les requêtes qui
 * ne présentent aucune clé — et le vrai budget est celui de la clé, donc d'un
 * utilisateur sur une école, appliqué après la résolution de portée.
 *
 * Une clé bien formée mais inconnue échappe par conséquent à tout étage : elle coûte un
 * `findByHash` indexé, et l'y soumettre par adresse recréerait exactement le déni entre
 * écoles que cette séparation supprime.
 */
const isAnonymousRateLimited = createRateLimiter({ limit: 120, windowMs: 60 * 1000 })
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
    // Lecture d'en-tête pure, donc gratuite : elle décide de l'étage à appliquer avant
    // que le drapeau plateforme ne coûte une lecture en base.
    const credential = readMcpCredential(request.headers)
    if (!credential && isAnonymousRateLimited(getClientIp(request))) {
      return denied('tooManyRequests', 429)
    }

    if (!(await isMcpEnabled())) return denied('mcpDisabled', 503)

    const result = await resolveMcpScope(credential)
    if (result.status === 'unauthenticated') return denied('unauthorized', 401)
    if (result.status === 'forbidden') return denied('forbidden', 403)

    const { scope } = result
    if (isKeyRateLimited(scope.keyId)) return denied('tooManyRequests', 429)

    const now = new Date()
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
