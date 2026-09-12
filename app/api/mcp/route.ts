import { createMcpHandler } from '@modelcontextprotocol/server'
import { after, NextResponse } from 'next/server'
import { isWellFormedMcpKey } from '@/domain/mcp-key'
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
 * ne présentent aucune clé bien formée — et le vrai budget est celui de la clé, donc
 * d'un utilisateur sur une école, appliqué après la résolution de portée.
 *
 * Toute clé bien formée que la route ne sert pas échappe par conséquent aux deux
 * étages : inconnue, révoquée ou expirée, elle coûte la lecture du drapeau puis un
 * `findByHash` indexé ; portée refusée, elle va jusqu'aux lectures d'appartenance. La
 * soumettre à l'étage par adresse recréerait exactement le déni entre écoles que cette
 * séparation supprime.
 */
const isAddressRateLimited = createRateLimiter({ limit: 120, windowMs: 60 * 1000 })
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
    // Lecture et vérification de forme : deux opérations pures, donc gratuites, qui
    // décident de l'étage avant que le drapeau plateforme ne coûte une lecture en base.
    // Une chaîne mal formée ne présente pas de clé — l'exempter laisserait un en-tête
    // quelconque échapper aux deux étages tout en payant cette lecture.
    const credential = readMcpCredential(request.headers)
    const presentsKey = credential !== null && isWellFormedMcpKey(credential)
    if (!presentsKey && isAddressRateLimited(getClientIp(request))) {
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
