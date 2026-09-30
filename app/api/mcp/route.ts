import { createMcpHandler } from '@modelcontextprotocol/server'
import { after, NextResponse } from 'next/server'
import { isWellFormedMcpKey } from '@/domain/mcp-key'
import { isWellFormedAccessToken, protectedResourceMetadataUrl } from '@/domain/mcp-oauth'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { appOrigin } from '@/lib/app-url'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { buildMcpServer } from '@/mcp/server'
import { purgeExpiredOAuthTokens } from '@/use-cases/mcp/oauth/purge-expired-tokens'
import { purgeExpiredDrafts } from '@/use-cases/mcp/purge-expired-drafts'
import { type McpScope, resolveMcpScope } from '@/use-cases/mcp/resolve-mcp-scope'
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
 * ne présentent aucune preuve bien formée — et le vrai budget est celui de la preuve,
 * donc d'un utilisateur sur une école, appliqué après la résolution de portée.
 *
 * Toute preuve bien formée que la route ne sert pas échappe par conséquent aux deux
 * étages : inconnue, révoquée ou expirée, elle coûte la lecture du drapeau puis un
 * `findByHash` indexé ; portée refusée, elle va jusqu'aux lectures d'appartenance. La
 * soumettre à l'étage par adresse recréerait exactement le déni entre écoles que cette
 * séparation supprime.
 */
const isAddressRateLimited = createRateLimiter({ limit: 120, windowMs: 60 * 1000 })
const isCredentialRateLimited = createRateLimiter({ limit: 600, windowMs: 60 * 1000 })

const LAST_USED_STALE_MS = 60 * 1000

const handler = createMcpHandler(({ authInfo }) => buildMcpServer(scopeFromAuthInfo(authInfo)), {
  responseMode: 'json',
})

function denied(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers })
}

/**
 * `WWW-Authenticate` du 401 (RFC 9728 §5.1) : c'est par lui qu'un client OAuth découvre
 * où s'enregistrer et s'autoriser. L'origine vient de la configuration, jamais de `Host`.
 */
function unauthorized(presentedCredential: boolean) {
  const params = [
    ...(presentedCredential ? ['error="invalid_token"'] : []),
    `resource_metadata="${protectedResourceMetadataUrl(appOrigin())}"`,
  ]
  return denied('unauthorized', 401, { 'www-authenticate': `Bearer ${params.join(', ')}` })
}

async function touch(scope: McpScope, now: Date): Promise<void> {
  const staleBefore = new Date(now.getTime() - LAST_USED_STALE_MS)
  switch (scope.owner.kind) {
    case 'MCP_KEY':
      await mcpApiKeyGateway.touch(scope.owner.keyId, now, staleBefore)
      return
    case 'OAUTH_GRANT':
      await mcpOAuthGrantGateway.touch(scope.owner.grantId, scope.schoolId, now, staleBefore)
      return
    case 'ADMIN_SESSION':
      // Inatteignable : cette route ne résout jamais une session.
      return
  }
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
    // Une chaîne mal formée ne présente pas de preuve — l'exempter laisserait un en-tête
    // quelconque échapper aux deux étages tout en payant cette lecture.
    const credential = readMcpCredential(request.headers)
    const presentsCredential =
      credential !== null && (isWellFormedMcpKey(credential) || isWellFormedAccessToken(credential))
    if (!presentsCredential && isAddressRateLimited(getClientIp(request))) {
      return denied('tooManyRequests', 429)
    }

    const now = new Date()

    // Avant le drapeau : la rétention ne dépend pas de l'ouverture du service. Fermer le MCP
    // arrêterait sinon le balayage tout en laissant expirer des données personnelles.
    after(() => purgeExpiredDrafts(now))
    after(() => purgeExpiredOAuthTokens(now))

    if (!(await isMcpEnabled())) return denied('mcpDisabled', 503)

    const result = await resolveMcpScope(credential)
    if (result.status === 'unauthenticated') return unauthorized(presentsCredential)
    if (result.status === 'forbidden') return denied('forbidden', 403)

    const { scope } = result
    if (isCredentialRateLimited(scope.credentialId)) return denied('tooManyRequests', 429)

    after(() => touch(scope, now))

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
