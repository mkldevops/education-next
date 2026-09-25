import { APICallError } from 'ai'

export type ProviderErrorCode =
  | 'invalidKey'
  | 'quotaExceeded'
  | 'providerRateLimited'
  | 'timeout'
  | 'providerError'

/**
 * Réduit toute erreur du fournisseur à un code que l'interface sait traduire.
 *
 * Le message d'origine ne traverse jamais : il peut citer l'URL appelée, le corps de la
 * réponse ou des fragments du prompt. Le détail va dans le journal du serveur, sans la
 * clé ni les images, et le navigateur ne reçoit que le code.
 */
export function toProviderErrorCode(error: unknown): ProviderErrorCode {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode
    if (status === 401 || status === 403) return 'invalidKey'
    if (status === 402) return 'quotaExceeded'
    if (status === 429) return 'providerRateLimited'
    if (status === 408 || status === 504) return 'timeout'
    return 'providerError'
  }

  // `DOMException` n'hérite pas d'`Error` dans tous les environnements : on lit le nom.
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name: unknown }).name
    if (name === 'AbortError' || name === 'TimeoutError') return 'timeout'
  }

  return 'providerError'
}
