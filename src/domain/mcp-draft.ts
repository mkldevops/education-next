/**
 * Durée de vie d'un brouillon d'écriture. Assez longue pour qu'un humain lise le plan
 * résolu, assez courte pour qu'un plan calculé sur un état périmé ne s'engage pas :
 * une classe peut s'être remplie, une formule avoir changé de montant.
 */
export const MCP_DRAFT_TTL_MINUTES = 30

/**
 * Le checksum n'est pas un secret : c'est une preuve que le client a bien reçu le plan
 * qu'il engage. Douze caractères hexadécimaux suffisent à écarter un plan différent.
 */
export const MCP_DRAFT_CHECKSUM_LENGTH = 12

export type McpDraftLifecycle = {
  status: 'PENDING' | 'COMMITTED'
  expiresAt: Date
}

export function isDraftUsable(draft: McpDraftLifecycle, now: Date = new Date()): boolean {
  return draft.status === 'PENDING' && draft.expiresAt.getTime() > now.getTime()
}

export function draftExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MCP_DRAFT_TTL_MINUTES * 60 * 1000)
}

/**
 * Un refus nommé champ par champ, jamais un `validationError` opaque.
 *
 * Un modèle de vision doit pouvoir corriger sa lecture d'un chiffre ou d'un libellé de
 * classe ; lui répondre que « l'entrée est invalide » le force à tout redeviner.
 */
export type McpFinding = { field: string; value: string; reason: string }
