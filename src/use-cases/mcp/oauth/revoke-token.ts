import { isWellFormedAccessToken, isWellFormedRefreshToken } from '@/domain/mcp-oauth'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { hashMcpKey } from '@/lib/mcp-key-crypto'

type GrantGateway = Pick<typeof mcpOAuthGrantGateway, 'findTokenByHash' | 'revoke'>

/**
 * `POST /api/mcp/oauth/revoke` (RFC 7009) : le client rend un jeton, la connexion tombe.
 *
 * Révoquer la connexion et non le seul jeton présenté : un client qui se déconnecte ne
 * doit rien garder, et un jeton d'accès encore vivant n'a plus de raison d'être. La réponse
 * est toujours la même — un jeton inconnu n'apprend rien à qui le présente.
 */
export async function revokeOAuthToken(
  token: string | undefined,
  grantGw: GrantGateway = mcpOAuthGrantGateway
): Promise<'OK'> {
  if (!token || !(isWellFormedAccessToken(token) || isWellFormedRefreshToken(token))) return 'OK'

  const presented = await grantGw.findTokenByHash(hashMcpKey(token))
  if (!presented || presented.kind === 'CODE') return 'OK'

  await grantGw.revoke(presented.grantId, presented.grant.schoolId, new Date())
  return 'OK'
}
