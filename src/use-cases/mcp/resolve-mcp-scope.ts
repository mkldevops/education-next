import type { DraftOwner } from '@/domain/mcp-draft'
import { isKeyUsable, isWellFormedMcpKey } from '@/domain/mcp-key'
import { isWellFormedAccessToken } from '@/domain/mcp-oauth'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { userGateway } from '@/gateways/user-gateway'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { resolveMcpOAuthScope } from './oauth/resolve-oauth-scope'

/**
 * Portée d'un appelant machine, calquée sur `SchoolContext` **moins la variante
 * `PARENT`**, qui est ici irreprésentable.
 *
 * L'autorisation d'un parent a la forme d'un `familyId`, pas d'un `schoolId` : l'admettre
 * créerait un second mécanisme de cantonnement à côté du garde tenant. Le MCP n'ouvre que
 * l'administration d'école.
 *
 * `paymentsEnabled` est résolu une fois ici, jamais relu par `buildMcpServer` ni par un
 * use case : c'est le seul endroit qui consulte `isPaymentsEnabled` pour le MCP, ce qui
 * garde la construction du serveur synchrone et la décision stable pour toute la requête.
 *
 * `credentialId` et `credentialPrefix` désignent la clé API ou la connexion OAuth qui a
 * authentifié l'appel — budget de limitation et identifiant côté SDK. `owner` est la
 * projection de cette preuve en propriétaire de brouillon : c'est la seule chose que les
 * use cases partagés avec l'assistant d'inscription lisent pour cantonner un plan.
 */
export type McpScope =
  | {
      credentialId: string
      credentialPrefix: string
      userId: string
      schoolId: string
      isSuperAdmin: true
      paymentsEnabled: boolean
      owner: DraftOwner
    }
  | {
      credentialId: string
      credentialPrefix: string
      userId: string
      schoolId: string
      isSuperAdmin: false
      paymentsEnabled: boolean
      owner: DraftOwner
    }

export type McpScopeResult =
  | { status: 'OK'; scope: McpScope }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }

/**
 * Dépendances décrites par ce dont ce use case a besoin, pas par le type complet de
 * chaque passerelle : un test injecte des fonctions ciblées au lieu d'objets entiers.
 */
type Deps = {
  keyGw?: Pick<typeof mcpApiKeyGateway, 'findByHash'>
  userGw?: Pick<typeof userGateway, 'findPlatformLevel'>
  schoolGw?: Pick<typeof schoolGateway, 'findActiveById'>
  memberGw?: Pick<typeof schoolMemberGateway, 'findMembership'>
  checkPaymentsEnabled?: (schoolId: string) => Promise<boolean>
  resolveOAuthScope?: typeof resolveMcpOAuthScope
}

/**
 * Authentifie une preuve présentée et en déduit la portée.
 *
 * Un use case qui authentifie est le précédent de `authenticate-with-passkey` : il prend
 * une preuve opaque et rend un verdict typé, sans toucher aux en-têtes ni rediriger. Les
 * quatre gardes de `auth-helper.ts` se terminent toutes par une navigation Next, donc
 * aucune n'est utilisable depuis un gestionnaire JSON-RPC.
 *
 * Le préfixe décide du chemin : `edu_mcp_` est une clé API, `edu_oat_` un jeton d'accès
 * OAuth — même verdict, mêmes gardes, table différente. Les deux preuves coexistent : une
 * clé déjà distribuée reste valable.
 *
 * Révocation, expiration, compte désactivé et appartenance retirée sont tous relus à
 * chaque appel : une preuve durable ne doit jamais survivre à la perte du droit qui la
 * justifiait.
 */
export async function resolveMcpScope(
  presentedKey: string | null,
  { keyGw, userGw, schoolGw, memberGw, checkPaymentsEnabled, resolveOAuthScope }: Deps = {}
): Promise<McpScopeResult> {
  const keys = keyGw ?? mcpApiKeyGateway
  const users = userGw ?? userGateway
  const schools = schoolGw ?? schoolGateway
  const members = memberGw ?? schoolMemberGateway
  const readPaymentsEnabled = checkPaymentsEnabled ?? isPaymentsEnabled

  // Forme vérifiée avant tout accès base : une chaîne quelconque ne doit pas coûter
  // une requête.
  if (!presentedKey) return { status: 'unauthenticated' }
  if (isWellFormedAccessToken(presentedKey)) {
    return (resolveOAuthScope ?? resolveMcpOAuthScope)(presentedKey, {
      userGw: users,
      schoolGw: schools,
      memberGw: members,
      checkPaymentsEnabled: readPaymentsEnabled,
    })
  }
  if (!isWellFormedMcpKey(presentedKey)) return { status: 'unauthenticated' }

  const key = await keys.findByHash(hashMcpKey(presentedKey))
  if (!key || !isKeyUsable(key)) return { status: 'unauthenticated' }

  // `findPlatformLevel` lit par `db` : un compte désactivé remonte `null`, ce qui vaut
  // révocation de toutes ses clés sans écriture.
  const user = await users.findPlatformLevel(key.userId)
  if (!user) return { status: 'forbidden' }

  // Indépendants l'un de l'autre : le drapeau se lit par école, pas par droit d'accès.
  const [school, paymentsEnabled] = await Promise.all([
    schools.findActiveById(key.schoolId),
    readPaymentsEnabled(key.schoolId),
  ])
  if (!school) return { status: 'forbidden' }

  const scope = {
    credentialId: key.id,
    credentialPrefix: key.prefix,
    userId: key.userId,
    schoolId: key.schoolId,
    owner: { kind: 'MCP_KEY' as const, keyId: key.id },
  }

  if (user.isSuperAdmin) {
    return { status: 'OK', scope: { ...scope, isSuperAdmin: true, paymentsEnabled } }
  }

  const membership = await members.findMembership(key.userId, key.schoolId)
  if (!membership?.roles.includes('ADMIN')) return { status: 'forbidden' }

  return { status: 'OK', scope: { ...scope, isSuperAdmin: false, paymentsEnabled } }
}
