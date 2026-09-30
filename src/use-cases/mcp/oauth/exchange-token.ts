import {
  accessTokenExpiry,
  authorizationCodeGrantSchema,
  isGrantUsable,
  isSameResource,
  isTokenUsable,
  MCP_OAUTH_ACCESS_TOKEN_PREFIX,
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  MCP_OAUTH_REFRESH_TOKEN_PREFIX,
  MCP_OAUTH_SCOPE,
  mcpOAuthPrefix,
  pkceMatches,
  refreshTokenExpiry,
  refreshTokenGrantSchema,
} from '@/domain/mcp-oauth'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { generateMcpSecret, hashMcpKey, sha256Base64Url } from '@/lib/mcp-key-crypto'

type GrantGateway = Pick<
  typeof mcpOAuthGrantGateway,
  'findTokenByHash' | 'consumeAndIssue' | 'revoke'
>

type TokenResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/** Codes d'erreur de RFC 6749 §5.2, rendus tels quels par la route. */
type TokenError =
  | 'invalid_request'
  | 'invalid_grant'
  | 'invalid_client'
  | 'unsupported_grant_type'
  | 'invalid_target'

export type ExchangeResult = { status: 'OK'; tokens: TokenResponse } | { status: TokenError }

type Presented = NonNullable<Awaited<ReturnType<GrantGateway['findTokenByHash']>>>

/**
 * Un secret déjà consommé qui revient est la signature d'un vol de code ou de jeton de
 * rafraîchissement (RFC 6749 §4.1.2, RFC 6819 §5.2.2.3) : la connexion entière tombe, les
 * jetons d'accès vivants compris, puisque `resolveMcpOAuthScope` relit la connexion.
 */
async function refuseAndRevokeIfReplayed(
  grants: GrantGateway,
  presented: Presented,
  now: Date
): Promise<'invalid_grant'> {
  if (presented.consumedAt !== null && isGrantUsable(presented.grant)) {
    await grants.revoke(presented.grantId, presented.grant.schoolId, now)
  }
  return 'invalid_grant'
}

async function issue(grants: GrantGateway, presented: Presented, now: Date) {
  const accessToken = generateMcpSecret(MCP_OAUTH_ACCESS_TOKEN_PREFIX)
  const refreshToken = generateMcpSecret(MCP_OAUTH_REFRESH_TOKEN_PREFIX)

  const issued = await grants.consumeAndIssue(
    presented.id,
    presented.kind,
    presented.grantId,
    now,
    {
      access: {
        tokenHash: hashMcpKey(accessToken),
        prefix: mcpOAuthPrefix(accessToken),
        expiresAt: accessTokenExpiry(now),
      },
      refresh: {
        tokenHash: hashMcpKey(refreshToken),
        prefix: mcpOAuthPrefix(refreshToken),
        expiresAt: refreshTokenExpiry(now),
      },
    }
  )
  // Perdu la course contre un échange concurrent du même secret : même verdict qu'un rejeu.
  if (issued === null) return null

  return {
    access_token: accessToken,
    token_type: 'Bearer' as const,
    expires_in: MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: MCP_OAUTH_SCOPE,
  }
}

/**
 * `POST /api/mcp/oauth/token`, pour les deux types de subvention.
 *
 * L'échange d'un code revérifie tout ce que le code a vu naître : le client, l'URI de
 * redirection, le vérificateur PKCE face au défi, et la ressource face à l'audience figée.
 * Le rafraîchissement tourne le jeton : l'ancien est consommé dans la transaction qui
 * émet le nouveau.
 */
export async function exchangeOAuthToken(
  body: Record<string, string | undefined>,
  grantGw: GrantGateway = mcpOAuthGrantGateway
): Promise<ExchangeResult> {
  const now = new Date()

  if (body.grant_type === 'authorization_code') {
    const parsed = authorizationCodeGrantSchema.safeParse(body)
    if (!parsed.success) return { status: 'invalid_request' }
    const { code, code_verifier, client_id, redirect_uri, resource } = parsed.data

    const presented = await grantGw.findTokenByHash(hashMcpKey(code))
    if (presented?.kind !== 'CODE') return { status: 'invalid_grant' }
    if (presented.grant.clientId !== client_id) return { status: 'invalid_client' }
    if (!isTokenUsable(presented, now) || !isGrantUsable(presented.grant)) {
      return { status: await refuseAndRevokeIfReplayed(grantGw, presented, now) }
    }
    if (redirect_uri !== undefined && redirect_uri !== presented.redirectUri) {
      return { status: 'invalid_grant' }
    }
    if (!pkceMatches(code_verifier, presented.codeChallenge ?? '', sha256Base64Url)) {
      return { status: 'invalid_grant' }
    }
    if (resource !== undefined && !isSameResource(resource, presented.grant.resource)) {
      return { status: 'invalid_target' }
    }

    const tokens = await issue(grantGw, presented, now)
    return tokens ? { status: 'OK', tokens } : { status: 'invalid_grant' }
  }

  if (body.grant_type === 'refresh_token') {
    const parsed = refreshTokenGrantSchema.safeParse(body)
    if (!parsed.success) return { status: 'invalid_request' }
    const { refresh_token, client_id, resource } = parsed.data

    const presented = await grantGw.findTokenByHash(hashMcpKey(refresh_token))
    if (presented?.kind !== 'REFRESH') return { status: 'invalid_grant' }
    if (presented.grant.clientId !== client_id) return { status: 'invalid_client' }
    if (!isTokenUsable(presented, now) || !isGrantUsable(presented.grant)) {
      return { status: await refuseAndRevokeIfReplayed(grantGw, presented, now) }
    }
    if (resource !== undefined && !isSameResource(resource, presented.grant.resource)) {
      return { status: 'invalid_target' }
    }

    const tokens = await issue(grantGw, presented, now)
    return tokens ? { status: 'OK', tokens } : { status: 'invalid_grant' }
  }

  return { status: 'unsupported_grant_type' }
}
