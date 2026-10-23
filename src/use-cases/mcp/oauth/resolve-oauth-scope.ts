import {
  isGrantUsable,
  isSameResource,
  isTokenUsable,
  isWellFormedAccessToken,
  mcpOAuthPrefix,
  mcpResourceUrl,
} from '@/domain/mcp-oauth'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { userGateway } from '@/gateways/user-gateway'
import { appOrigin } from '@/lib/app-url'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import type { McpScopeResult } from '../resolve-mcp-scope'

type Deps = {
  grantGw?: Pick<typeof mcpOAuthGrantGateway, 'findTokenByHash'>
  userGw?: Pick<typeof userGateway, 'findPlatformLevel'>
  schoolGw?: Pick<typeof schoolGateway, 'findActiveById'>
  memberGw?: Pick<typeof schoolMemberGateway, 'findMembership'>
  checkPaymentsEnabled?: (schoolId: string) => Promise<boolean>
  /** Origine de ce site ; par défaut `NEXT_PUBLIC_APP_URL`, jamais l'en-tête `Host`. */
  origin?: string
}

/**
 * Authentifie un jeton d'accès OAuth et en déduit la portée, à chaque appel.
 *
 * Même séquence que `resolveMcpScope` pour une clé, avec deux gardes de plus : la
 * connexion doit être vivante — la révocation depuis l'onglet ou par `/revoke` prend
 * effet au prochain appel, jeton d'accès encore valide ou non — et l'audience figée doit
 * être ce site. Un jeton émis par le site A porte l'URL du site A : présenté au site B,
 * il est refusé comme non authentifié, avant toute lecture d'utilisateur ou d'école.
 */
export async function resolveMcpOAuthScope(
  presentedToken: string,
  { grantGw, userGw, schoolGw, memberGw, checkPaymentsEnabled, origin }: Deps = {}
): Promise<McpScopeResult> {
  const grants = grantGw ?? mcpOAuthGrantGateway
  const users = userGw ?? userGateway
  const schools = schoolGw ?? schoolGateway
  const members = memberGw ?? schoolMemberGateway
  const readPaymentsEnabled = checkPaymentsEnabled ?? isPaymentsEnabled

  if (!isWellFormedAccessToken(presentedToken)) return { status: 'unauthenticated' }

  const now = new Date()
  const token = await grants.findTokenByHash(hashMcpKey(presentedToken))
  if (token?.kind !== 'ACCESS' || !isTokenUsable(token, now)) {
    return { status: 'unauthenticated' }
  }

  const { grant } = token
  if (!isGrantUsable(grant)) return { status: 'unauthenticated' }
  if (!isSameResource(grant.resource, mcpResourceUrl(origin ?? appOrigin()))) {
    return { status: 'unauthenticated' }
  }

  const user = await users.findPlatformLevel(grant.userId)
  if (!user) return { status: 'forbidden' }

  const [school, paymentsEnabled] = await Promise.all([
    schools.findActiveById(grant.schoolId),
    readPaymentsEnabled(grant.schoolId),
  ])
  if (!school) return { status: 'forbidden' }

  const scope = {
    credentialId: grant.id,
    credentialPrefix: mcpOAuthPrefix(presentedToken),
    userId: grant.userId,
    schoolId: grant.schoolId,
    owner: { kind: 'OAUTH_GRANT' as const, grantId: grant.id },
  }

  if (user.isSuperAdmin) {
    return { status: 'OK', scope: { ...scope, isSuperAdmin: true, paymentsEnabled } }
  }

  const membership = await members.findMembership(grant.userId, grant.schoolId)
  if (!membership?.roles.includes('ADMIN')) return { status: 'forbidden' }

  return { status: 'OK', scope: { ...scope, isSuperAdmin: false, paymentsEnabled } }
}
