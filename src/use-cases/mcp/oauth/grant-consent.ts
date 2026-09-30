import { z } from 'zod'
import { codeExpiry, MCP_OAUTH_CODE_PREFIX, mcpOAuthPrefix } from '@/domain/mcp-oauth'
import { mcpOAuthClientGateway } from '@/gateways/mcp-oauth-client-gateway'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { generateMcpSecret, hashMcpKey } from '@/lib/mcp-key-crypto'
import { validateAuthorizeRequest } from './validate-authorize-request'

type Deps = {
  clientGw?: Pick<typeof mcpOAuthClientGateway, 'findById'>
  grantGw?: Pick<typeof mcpOAuthGrantGateway, 'createWithCode'>
  schoolGw?: Pick<typeof schoolGateway, 'findActiveById'>
  memberGw?: Pick<typeof schoolMemberGateway, 'findMembership'>
}

const consentInputSchema = z.object({
  schoolId: z.uuid(),
})

type Input = {
  /** Utilisateur connecté, déjà authentifié par l'appelant. */
  user: { id: string; isSuperAdmin: boolean }
  /** École choisie sur l'écran de consentement. */
  schoolId: string
  /** Paramètres de la requête d'autorisation, rejoués tels que la page les a reçus. */
  query: Record<string, string | undefined>
  origin: string
}

export type ConsentResult =
  | { status: 'OK'; redirectTo: string }
  | { status: 'forbidden' }
  | { status: 'invalidRequest' }

/**
 * L'administrateur a validé : la connexion est créée sur l'école choisie et un code
 * d'autorisation à usage unique part vers le client.
 *
 * Tout est revérifié ici, indépendamment de ce que la page a affiché : le client, l'URI,
 * la ressource, et surtout le droit — super-admin, ou `ADMIN` de cette école, active. Un
 * formulaire modifié à la main ne fait pas plus qu'une requête honnête.
 */
export async function grantOAuthConsent(
  input: Input,
  { clientGw, grantGw, schoolGw, memberGw }: Deps = {}
): Promise<ConsentResult> {
  const clients = clientGw ?? mcpOAuthClientGateway
  const grants = grantGw ?? mcpOAuthGrantGateway
  const schools = schoolGw ?? schoolGateway
  const members = memberGw ?? schoolMemberGateway

  const parsed = consentInputSchema.safeParse({ schoolId: input.schoolId })
  if (!parsed.success) return { status: 'invalidRequest' }

  const validation = await validateAuthorizeRequest(input.query, input.origin, clients)
  if (validation.status !== 'OK') return { status: 'invalidRequest' }

  const school = await schools.findActiveById(parsed.data.schoolId)
  if (!school) return { status: 'forbidden' }

  if (!input.user.isSuperAdmin) {
    const membership = await members.findMembership(input.user.id, school.id)
    if (membership?.role !== 'ADMIN') return { status: 'forbidden' }
  }

  const now = new Date()
  const code = generateMcpSecret(MCP_OAUTH_CODE_PREFIX)
  const { request, client, resource } = validation

  await grants.createWithCode(
    {
      schoolId: school.id,
      userId: input.user.id,
      clientId: client.id,
      clientName: client.clientName,
      resource,
    },
    {
      tokenHash: hashMcpKey(code),
      prefix: mcpOAuthPrefix(code),
      expiresAt: codeExpiry(now),
      codeChallenge: request.code_challenge,
      redirectUri: request.redirect_uri,
    }
  )

  const url = new URL(request.redirect_uri)
  url.searchParams.set('code', code)
  if (request.state !== undefined) url.searchParams.set('state', request.state)
  url.searchParams.set('iss', new URL(input.origin).origin)

  return { status: 'OK', redirectTo: url.toString() }
}
