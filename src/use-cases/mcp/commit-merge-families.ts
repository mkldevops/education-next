import { z } from 'zod'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { mergeFamilies } from '@/use-cases/families/merge-families'
import { claimResolved, commitInTransaction } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { MERGE_FAMILIES_TOOL } from './preview-merge-families'
import type { commitDraftSchema } from './schemas'

const resolvedSchema = z.object({
  tool: z.literal(MERGE_FAMILIES_TOOL),
  source: z.object({ id: z.uuid(), name: z.string() }),
  target: z.object({ id: z.uuid(), name: z.string() }),
  stateChecksum: z.string().length(MCP_DRAFT_CHECKSUM_LENGTH),
})

export async function commitMergeFamilies(
  scope: DraftScope,
  input: z.infer<typeof commitDraftSchema>
) {
  const claim = await claimResolved(scope, MERGE_FAMILIES_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { schoolId } = scope
  const { source, target, stateChecksum } = claim.resolved
  return commitInTransaction(
    schoolId,
    claim.draftId,
    async (tx) => {
      const result = await mergeFamilies(
        { schoolId, sourceId: source.id, targetId: target.id },
        {
          transaction: tx,
          expectedStateChecksum: stateChecksum,
        }
      )
      if (result !== 'OK') return result
      return { sourceId: source.id, targetId: target.id, sourceArchived: true, merged: true }
    },
    { isolationLevel: 'ReadCommitted' }
  )
}
