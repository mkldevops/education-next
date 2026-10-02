import { isWellFormedAccessToken, isWellFormedRefreshToken } from '@/domain/mcp-oauth'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { hashMcpKey } from '@/lib/mcp-key-crypto'

type GrantGateway = Pick<typeof mcpOAuthGrantGateway, 'findTokenByHash' | 'revoke'>

/**
 * `POST /api/mcp/oauth/revoke` (RFC 7009) : le client rend un jeton, la connexion tombe.
 *
 * Révoquer la connexion et non le seul jeton présenté : un client qui se déconnecte ne
 * doit rien garder, et un jeton d'accès encore vivant n'a plus de raison d'être. Un jeton
 * inconnu répond toujours `OK` — il n'apprend rien à qui le présente.
 *
 * Un client public s'identifie par son `client_id` (RFC 6749 §2.3) et ne révoque que ses
 * propres jetons (RFC 7009 §2.1) : un jeton intercepté ne suffit pas à couper la connexion
 * d'un autre client.
 */
export async function revokeOAuthToken(
  input: { token: string | undefined; clientId: string | undefined },
  grantGw: GrantGateway = mcpOAuthGrantGateway
): Promise<'OK' | 'invalid_client'> {
  if (!input.clientId) return 'invalid_client'

  const { token } = input
  if (!token || !(isWellFormedAccessToken(token) || isWellFormedRefreshToken(token))) return 'OK'

  const presented = await grantGw.findTokenByHash(hashMcpKey(token))
  if (!presented || presented.kind === 'CODE') return 'OK'
  if (presented.grant.clientId !== input.clientId) return 'invalid_client'

  await grantGw.revoke(presented.grantId, presented.grant.schoolId, new Date())
  return 'OK'
}
