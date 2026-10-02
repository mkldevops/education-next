import { z } from 'zod'
import { DAY_MS } from './day'

/**
 * Trois secrets opaques, trois préfixes : un code d'autorisation, un jeton d'accès et un
 * jeton de rafraîchissement ne se ressemblent pas dans un journal, et la route reconnaît
 * un jeton d'accès à sa forme avant de coûter une lecture en base — comme `edu_mcp_`.
 */
export const MCP_OAUTH_CODE_PREFIX = 'edu_oac_'
export const MCP_OAUTH_ACCESS_TOKEN_PREFIX = 'edu_oat_'
export const MCP_OAUTH_REFRESH_TOKEN_PREFIX = 'edu_ort_'

const SECRET_BODY = '[A-Za-z0-9_-]{43}'
const ACCESS_TOKEN_PATTERN = new RegExp(`^${MCP_OAUTH_ACCESS_TOKEN_PREFIX}${SECRET_BODY}$`)
const REFRESH_TOKEN_PATTERN = new RegExp(`^${MCP_OAUTH_REFRESH_TOKEN_PREFIX}${SECRET_BODY}$`)
const CODE_PATTERN = new RegExp(`^${MCP_OAUTH_CODE_PREFIX}${SECRET_BODY}$`)

/** Fragment stocké en clair, seul repère visuel d'une connexion dans la liste. */
const MCP_OAUTH_PREFIX_LENGTH = 12

/**
 * Un code s'échange en quelques secondes ; un jeton d'accès vit une heure, ce qui borne la
 * fenêtre d'un vol sans forcer une reconnexion : le jeton de rafraîchissement, tourné à
 * chaque usage, la repousse d'un mois à partir du dernier échange.
 */
export const MCP_OAUTH_CODE_TTL_SECONDS = 5 * 60
export const MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const MCP_OAUTH_REFRESH_TOKEN_TTL_DAYS = 30

/**
 * L'enregistrement est anonyme : un client qui n'a obtenu aucune connexion dans la journée
 * ne sert plus à rien et tombe à la purge. Un client légitime enregistre puis consent dans
 * la foulée ; s'il revient plus tard, il se réenregistre.
 */
const MCP_OAUTH_UNUSED_CLIENT_TTL_DAYS = 1

/** Seule portée existante : le MCP n'ouvre que l'administration d'école. */
export const MCP_OAUTH_SCOPE = 'school:admin'

const MCP_OAUTH_MAX_REDIRECT_URIS = 5

export type McpOAuthTokenKind = 'CODE' | 'ACCESS' | 'REFRESH'

export function isWellFormedAccessToken(value: string): boolean {
  return ACCESS_TOKEN_PATTERN.test(value)
}

export function isWellFormedRefreshToken(value: string): boolean {
  return REFRESH_TOKEN_PATTERN.test(value)
}

export function isWellFormedAuthorizationCode(value: string): boolean {
  return CODE_PATTERN.test(value)
}

export function mcpOAuthPrefix(secret: string): string {
  return secret.slice(0, MCP_OAUTH_PREFIX_LENGTH)
}

type TokenLifecycle = { expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null }

/** Consommé, révoqué ou expiré : un seul refus, pour la même raison que `isKeyUsable`. */
export function isTokenUsable(token: TokenLifecycle, now: Date = new Date()): boolean {
  return (
    token.consumedAt === null &&
    token.revokedAt === null &&
    token.expiresAt.getTime() > now.getTime()
  )
}

type GrantLifecycle = { revokedAt: Date | null }

export function isGrantUsable(grant: GrantLifecycle): boolean {
  return grant.revokedAt === null
}

export function codeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MCP_OAUTH_CODE_TTL_SECONDS * 1000)
}

export function accessTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000)
}

export function refreshTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MCP_OAUTH_REFRESH_TOKEN_TTL_DAYS * DAY_MS)
}

/** Les clients enregistrés avant cette date et sans aucune connexion sont purgés. */
export function unusedClientCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - MCP_OAUTH_UNUSED_CLIENT_TTL_DAYS * DAY_MS)
}

/**
 * URL canonique de la ressource protégée : l'audience de tout jeton émis par ce site.
 *
 * Le site est choisi par l'URL MCP saisie dans ChatGPT et par rien d'autre : un jeton du
 * site A présenté au site B ne porte pas son audience, et ce test le refuse avant toute
 * lecture d'appartenance.
 */
export function mcpResourceUrl(origin: string): string {
  return `${new URL(origin).origin}/api/mcp`
}

function normalizeResource(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.hash || url.search) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/** Comparaison après normalisation : ChatGPT peut poster la ressource avec une barre finale. */
export function isSameResource(presented: string, expected: string): boolean {
  const left = normalizeResource(presented)
  return left !== null && left === normalizeResource(expected)
}

/**
 * Une URI de redirection est acceptée en `https`, ou en `http` vers la boucle locale pour
 * le développement. Ni fragment ni schéma exotique : le code d'autorisation y transite.
 */
export function isAcceptableRedirectUri(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.hash) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

/**
 * Vérification PKCE S256 (RFC 7636 §4.6) : `BASE64URL(SHA256(verifier)) === challenge`.
 *
 * Le hachage est fourni par l'appelant : le domaine ne touche pas à `node:crypto`.
 */
export function pkceMatches(
  codeVerifier: string,
  codeChallenge: string,
  sha256Base64Url: (value: string) => string
): boolean {
  if (!PKCE_VERIFIER_PATTERN.test(codeVerifier)) return false
  return sha256Base64Url(codeVerifier) === codeChallenge
}

const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/
const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

const REDIRECT_URI_MAX_LENGTH = 512
const STATE_MAX_LENGTH = 1024

const redirectUriSchema = z
  .string()
  .max(REDIRECT_URI_MAX_LENGTH)
  .refine(isAcceptableRedirectUri, { message: 'redirect_uri' })

/**
 * Enregistrement dynamique (RFC 7591) d'un client public : ChatGPT s'enregistre lui-même
 * à la première connexion, sans identifiant saisi à la main. Seul `none` est admis comme
 * authentification du client — la preuve est PKCE, pas un secret partagé.
 */
export const registerClientSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  redirect_uris: z.array(redirectUriSchema).min(1).max(MCP_OAUTH_MAX_REDIRECT_URIS),
  token_endpoint_auth_method: z.literal('none').optional(),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
  response_types: z.array(z.literal('code')).optional(),
})

/** Un `scope` absent vaut la seule portée existante ; toute autre valeur est refusée. */
const scopeSchema = z
  .string()
  .max(200)
  .optional()
  .transform((value) =>
    value === undefined || value.trim() === '' ? [] : value.trim().split(/\s+/)
  )
  .refine((scopes) => scopes.every((scope) => scope === MCP_OAUTH_SCOPE), { message: 'scope' })

export const authorizeRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.uuid(),
  redirect_uri: z.string().max(REDIRECT_URI_MAX_LENGTH).refine(isAcceptableRedirectUri),
  code_challenge: z.string().regex(PKCE_CHALLENGE_PATTERN),
  code_challenge_method: z.literal('S256'),
  state: z.string().max(STATE_MAX_LENGTH).optional(),
  scope: scopeSchema,
  resource: z.string().max(REDIRECT_URI_MAX_LENGTH).optional(),
})

export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>

export const authorizationCodeGrantSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().refine(isWellFormedAuthorizationCode),
  code_verifier: z.string().regex(PKCE_VERIFIER_PATTERN),
  client_id: z.uuid(),
  redirect_uri: z.string().max(REDIRECT_URI_MAX_LENGTH).optional(),
  resource: z.string().max(REDIRECT_URI_MAX_LENGTH).optional(),
})

export const refreshTokenGrantSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().refine(isWellFormedRefreshToken),
  client_id: z.uuid(),
  resource: z.string().max(REDIRECT_URI_MAX_LENGTH).optional(),
})

/**
 * Métadonnées du serveur d'autorisation (RFC 8414), telles que ChatGPT les lit.
 *
 * PKCE `S256` et `none` sont les seules valeurs annoncées : un client sans PKCE n'a pas
 * de chemin. `authorization_response_iss_parameter_supported` engage à renvoyer `iss`
 * sur chaque redirection, ce que la page de consentement fait.
 */
export function authorizationServerMetadata(origin: string) {
  const issuer = new URL(origin).origin

  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [MCP_OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
  }
}

/** Métadonnées de la ressource protégée (RFC 9728) : la ressource nomme son émetteur. */
export function protectedResourceMetadata(origin: string) {
  const issuer = new URL(origin).origin

  return {
    resource: mcpResourceUrl(issuer),
    authorization_servers: [issuer],
    scopes_supported: [MCP_OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
  }
}

export function protectedResourceMetadataUrl(origin: string): string {
  return `${new URL(origin).origin}/.well-known/oauth-protected-resource`
}
