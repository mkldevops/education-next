import type { z } from 'zod'
import { dbArchived } from '@/lib/db'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import { readFamilyMergeState } from '@/use-cases/families/family-merge-state'
import { inspectFamilyMerge } from '@/use-cases/families/merge-families'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { previewMergeFamiliesSchema } from './schemas'

export const MERGE_FAMILIES_TOOL = 'merge_families'

type Input = z.input<typeof previewMergeFamiliesSchema>

export async function previewMergeFamilies(scope: DraftScope, input: Input) {
  const parsed = previewMergeFamiliesSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (parsed.data.sourceId === parsed.data.targetId) return 'sameFamily' as const
  const { schoolId } = scope
  const inspection = await inspectFamilyMerge(dbArchived, { ...parsed.data, schoolId })
  if (typeof inspection === 'string') {
    return blockedPreview({}, [], [{ field: 'families', value: '', reason: inspection }])
  }
  const state = await readFamilyMergeState(
    dbArchived,
    schoolId,
    parsed.data.sourceId,
    parsed.data.targetId
  )
  if (!state) return blockedPreview({}, [], [{ field: 'families', value: '', reason: 'notFound' }])

  const resolved = {
    tool: MERGE_FAMILIES_TOOL,
    ...state,
    stateChecksum: draftChecksum(state),
    effects: { sourceArchived: true, targetRetained: true, parentAccessCombined: true },
  }
  return saveDraftPreview(
    scope,
    MERGE_FAMILIES_TOOL,
    resolved,
    {},
    [{ field: 'accounts', value: '', reason: 'expandedFamilyAccess' }],
    []
  )
}
