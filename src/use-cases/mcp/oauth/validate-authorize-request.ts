import {
  type AuthorizeRequest,
  authorizeRequestSchema,
  isSameResource,
  mcpResourceUrl,
} from '@/domain/mcp-oauth'
import { mcpOAuthClientGateway } from '@/gateways/mcp-oauth-client-gateway'

type ClientGateway = Pick<typeof mcpOAuthClientGateway, 'findById'>

export type AuthorizeValidation =
  /** Le client et son URI sont connus : une erreur ultérieure peut lui être renvoyée. */
  | {
      status: 'OK'
      request: AuthorizeRequest
      client: { id: string; clientName: string }
      resource: string
    }
  /** Client inconnu ou URI non enregistrée : on n'y redirige jamais (RFC 6749 §4.1.2.1). */
  | { status: 'rejected'; reason: 'invalidClient' | 'invalidRedirectUri' | 'invalidRequest' }
  /** Le reste est renvoyé au client sur son URI, avec `error`. */
  | { status: 'redirectError'; redirectUri: string; state?: string; error: string }

/**
 * Vérifie une requête `/oauth/authorize` avant de montrer quoi que ce soit.
 *
 * La `resource` demandée doit être ce site : ChatGPT la pose depuis l'URL MCP saisie, et
 * c'est elle qui devient l'audience figée dans la connexion. Une ressource étrangère est
 * un mauvais site, pas une variante acceptable.
 */
export async function validateAuthorizeRequest(
  query: Record<string, string | undefined>,
  origin: string,
  clientGw: ClientGateway = mcpOAuthClientGateway
): Promise<AuthorizeValidation> {
  // Le client et l'URI se vérifient avant tout le reste : sans eux il n'y a personne à
  // qui rapporter une erreur.
  const clientId = query.client_id
  const redirectUri = query.redirect_uri
  if (!clientId || !redirectUri) return { status: 'rejected', reason: 'invalidRequest' }

  const client = clientId.length <= 64 ? await clientGw.findById(clientId) : null
  if (!client) return { status: 'rejected', reason: 'invalidClient' }
  if (!client.redirectUris.includes(redirectUri)) {
    return { status: 'rejected', reason: 'invalidRedirectUri' }
  }

  const parsed = authorizeRequestSchema.safeParse(query)
  if (!parsed.success) {
    const error = parsed.error.issues.some((issue) => issue.path[0] === 'scope')
      ? 'invalid_scope'
      : 'invalid_request'
    return { status: 'redirectError', redirectUri, state: query.state, error }
  }

  const resource = mcpResourceUrl(origin)
  if (parsed.data.resource !== undefined && !isSameResource(parsed.data.resource, resource)) {
    return {
      status: 'redirectError',
      redirectUri,
      state: parsed.data.state,
      error: 'invalid_target',
    }
  }

  return {
    status: 'OK',
    request: parsed.data,
    client: { id: client.id, clientName: client.clientName },
    resource,
  }
}

/** URL de retour vers le client, `iss` compris (RFC 9207). */
export function authorizationResponseUrl(
  redirectUri: string,
  origin: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  url.searchParams.set('iss', new URL(origin).origin)
  return url.toString()
}
