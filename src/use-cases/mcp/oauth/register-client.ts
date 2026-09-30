import { registerClientSchema } from '@/domain/mcp-oauth'
import { mcpOAuthClientGateway } from '@/gateways/mcp-oauth-client-gateway'

type ClientGateway = Pick<typeof mcpOAuthClientGateway, 'create'>

/**
 * Enregistrement dynamique d'un client public (RFC 7591).
 *
 * Aucun secret n'est émis : `token_endpoint_auth_method` est `none` et la preuve de
 * possession est PKCE. Le nom et les URI de redirection sont ce que la page de
 * consentement montre à l'administrateur avant qu'il n'accorde quoi que ce soit.
 */
export async function registerOAuthClient(
  input: unknown,
  clientGw: ClientGateway = mcpOAuthClientGateway
) {
  const parsed = registerClientSchema.safeParse(input)
  if (!parsed.success) return 'invalidClientMetadata' as const

  const client = await clientGw.create({
    clientName: parsed.data.client_name,
    redirectUris: [...new Set(parsed.data.redirect_uris)],
  })

  return {
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: 'none' as const,
    grant_types: ['authorization_code', 'refresh_token'] as const,
    response_types: ['code'] as const,
  }
}
