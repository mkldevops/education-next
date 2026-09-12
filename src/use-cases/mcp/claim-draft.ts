import { isDraftUsable, staleCommitBefore } from '@/domain/mcp-draft'
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
 *
 * Le brouillon appartient à la clé qui l'a proposé : une autre clé de la même école ne le
 * voit pas, et se l'entend refuser comme inexistant plutôt que comme interdit.
 */
export async function claimDraft(
  schoolId: string,
  keyId: string,
  tool: string,
  draftId: string,
  checksum: string,
  now: Date = new Date()
): Promise<ClaimOutcome> {
  const claimed = await mcpDraftGateway.claim(schoolId, keyId, draftId, tool, checksum, now)
  if (claimed.count === 1) {
    const draft = await mcpDraftGateway.findById(schoolId, draftId)
    if (!draft) return { status: 'draftNotFound' }
    return { status: 'claimed', resolved: draft.resolved }
  }

  const draft = await mcpDraftGateway.findById(schoolId, draftId)
  if (!draft || draft.tool !== tool || draft.keyId !== keyId) return { status: 'draftNotFound' }
  if (draft.checksum !== checksum) return { status: 'checksumMismatch' }

  if (draft.status === 'COMMITTED') {
    if (draft.result !== null) return { status: 'replayed', result: draft.result }

    // Engagé sans résultat : soit un commit concurrent est encore dans sa transaction,
    // soit il a été tué. Le résultat s'écrivant dans la transaction qui écrit les
    // données, un verrou plus vieux que le délai d'abandon se reprend sans doublon.
    const reclaimed = await mcpDraftGateway.reclaim(
      schoolId,
      keyId,
      draftId,
      tool,
      checksum,
      staleCommitBefore(now),
      now
    )
    if (reclaimed.count !== 1) return { status: 'commitInProgress' }

    const reclaimedDraft = await mcpDraftGateway.findById(schoolId, draftId)
    if (!reclaimedDraft) return { status: 'draftNotFound' }
    return { status: 'claimed', resolved: reclaimedDraft.resolved }
  }

  return isDraftUsable(draft, now) ? { status: 'draftNotFound' } : { status: 'draftExpired' }
}

/**
 * Rend le verrou d'un brouillon dont la transaction n'a rien écrit.
 *
 * Un refus métier constaté au commit — la classe s'est remplie, le solde a bougé — laisse
 * le brouillon intact : le client doit pouvoir refaire un `preview_*` sans attendre le
 * délai d'abandon, et surtout sans se voir répondre qu'un commit est en cours.
 */
export function releaseDraft(schoolId: string, draftId: string) {
  return mcpDraftGateway.release(schoolId, draftId)
}
