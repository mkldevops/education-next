import type { z } from 'zod'
import { isDraftUsable, staleCommitBefore } from '@/domain/mcp-draft'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import type { McpScope } from './resolve-mcp-scope'
import { commitDraftSchema } from './schemas'

type ClaimOutcome =
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
async function claimDraft(
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

type ResolvedClaim<S extends z.ZodTypeAny> =
  | { done: true; value: unknown }
  | { done: false; draftId: string; resolved: z.infer<S> }

/**
 * Valide l'entrée, prend le verrou et retraverse le plan relu par `schema`.
 *
 * `done` porte la réponse à rendre telle quelle : un refus, ou le résultat d'un commit
 * rejoué. Un plan illisible rend le verrou avant de refuser.
 */
export async function claimResolved<S extends z.ZodTypeAny>(
  scope: Pick<McpScope, 'schoolId' | 'keyId'>,
  tool: string,
  input: unknown,
  schema: S
): Promise<ResolvedClaim<S>> {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return { done: true, value: 'validationError' as const }
  const { schoolId, keyId } = scope
  const { draftId, checksum } = parsed.data

  const outcome = await claimDraft(schoolId, keyId, tool, draftId, checksum)
  if (outcome.status === 'replayed') return { done: true, value: outcome.result }
  if (outcome.status !== 'claimed') return { done: true, value: outcome.status }

  const plan = schema.safeParse(outcome.resolved)
  if (!plan.success) {
    await releaseDraft(schoolId, draftId)
    return { done: true, value: 'validationError' as const }
  }
  return { done: false, draftId, resolved: plan.data }
}

/**
 * Exécute l'écriture d'un brouillon engagé et y attache son résultat.
 *
 * `body` rend soit un refus (une chaîne), soit ce qui a été écrit.
 */
export async function commitInTransaction<T extends string | object>(
  schoolId: string,
  draftId: string,
  body: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    const result = await db.$transaction(async (tx) => {
      const written = await body(tx)
      if (typeof written === 'string') return written

      // Le résultat est écrit dans la transaction qui écrit les données : `result` nul
      // signifie alors « rien n'a été écrit », ce qui rend le verrou reprenable.
      await tx.mcpDraft.updateMany({ where: { id: draftId, schoolId }, data: { result: written } })

      return written
    })

    // Un refus constaté au commit n'a rien écrit : rendre le verrou laisse le client
    // refaire un `preview_*` sans attendre le délai d'abandon.
    if (typeof result === 'string') await releaseDraft(schoolId, draftId)

    return result
  } catch (error) {
    // La transaction a été annulée, résultat compris. Sans ce rattrapage le brouillon
    // resterait engagé sans résultat, donc injoignable jusqu'au délai d'abandon.
    await releaseDraft(schoolId, draftId)
    throw error
  }
}
