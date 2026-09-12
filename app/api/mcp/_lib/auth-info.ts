import type { AuthInfo } from '@modelcontextprotocol/server'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'

/**
 * La clé présentée ne transite **jamais** par `AuthInfo`.
 *
 * `authInfo` est lisible depuis chaque outil et peut finir sérialisé dans une erreur du
 * SDK : `token` porte le préfixe public de la clé, qui identifie sans authentifier.
 */
export function toAuthInfo(scope: McpScope): AuthInfo {
  return {
    token: scope.keyPrefix,
    clientId: scope.keyId,
    scopes: ['school:admin'],
    extra: { scope },
  }
}

export function scopeFromAuthInfo(authInfo: AuthInfo | undefined): McpScope {
  const scope = authInfo?.extra?.scope as McpScope | undefined
  // Inatteignable : la route ne construit une instance qu'après résolution de portée.
  // Lever plutôt que servir une instance sans école est le seul comportement sûr.
  if (!scope) throw new Error('mcp: missing resolved scope')

  return scope
}
