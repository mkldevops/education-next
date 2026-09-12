import { isDraftUsable } from '@/domain/mcp-draft'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'

export type ClaimOutcome =
  | { status: 'claimed'; resolved: unknown }
  | { status: 'replayed'; result: unknown }
  | { status: 'draftNotFound' }
  | { status: 'draftExpired' }
  | { status: 'checksumMismatch' }
  | { status: 'commitInProgress' }

/**
 * Prise du verrou, puis diagnostic de l'échec.
 *
 * L'ordre compte : on tente le `updateMany` conditionnel d'abord et on ne relit le
 * brouillon que s'il a échoué. Relire pour décider, puis écrire, laisserait deux commits
 * concurrents passer tous les deux — exactement le cas d'un client qui rejoue après une
 * coupure réseau.
 *
 * Un brouillon déjà engagé au même checksum n'est pas une erreur : sa réponse est le
 * résultat enregistré, et c'est ce qui empêche une seconde famille d'apparaître.
 */
export async function claimDraft(
  schoolId: string,
  tool: string,
  draftId: string,
  checksum: string,
  now: Date = new Date()
): Promise<ClaimOutcome> {
  const claimed = await mcpDraftGateway.claim(schoolId, draftId, tool, checksum, now)
  if (claimed.count === 1) {
    const draft = await mcpDraftGateway.findById(schoolId, draftId)
    if (!draft) return { status: 'draftNotFound' }
    return { status: 'claimed', resolved: draft.resolved }
  }

  const draft = await mcpDraftGateway.findById(schoolId, draftId)
  if (!draft || draft.tool !== tool) return { status: 'draftNotFound' }
  if (draft.checksum !== checksum) return { status: 'checksumMismatch' }

  if (draft.status === 'COMMITTED') {
    if (draft.result === null) return { status: 'commitInProgress' }
    return { status: 'replayed', result: draft.result }
  }

  return isDraftUsable(draft, now) ? { status: 'draftNotFound' } : { status: 'draftExpired' }
}
