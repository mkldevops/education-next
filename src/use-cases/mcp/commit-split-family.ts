import { z } from 'zod'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { splitFamily } from '@/use-cases/families/split-family'
import { claimResolved, commitInTransaction } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { SPLIT_FAMILY_TOOL } from './preview-split-family'
import type { commitDraftSchema } from './schemas'

const resolvedSchema = z.object({
  tool: z.literal(SPLIT_FAMILY_TOOL),
  name: z.string(),
  source: z.object({ id: z.uuid(), name: z.string() }),
  moved: z.array(z.object({ personId: z.uuid() })).min(1),
  stateChecksum: z.string().length(MCP_DRAFT_CHECKSUM_LENGTH),
})

export async function commitSplitFamily(
  scope: DraftScope,
  input: z.infer<typeof commitDraftSchema>
) {
  const claim = await claimResolved(scope, SPLIT_FAMILY_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { schoolId, userId } = scope
  const { name, source, moved, stateChecksum } = claim.resolved
  return commitInTransaction(
    schoolId,
    claim.draftId,
    async (tx) => {
      const result = await splitFamily(
        {
          schoolId,
          createdById: userId,
          sourceId: source.id,
          personIds: moved.map((member) => member.personId),
          name,
        },
        { transaction: tx, expectedStateChecksum: stateChecksum }
      )
      if (typeof result === 'string') return result
      return { sourceId: source.id, familyId: result.familyId, name: result.name, split: true }
    },
    { isolationLevel: 'ReadCommitted' }
  )
}
