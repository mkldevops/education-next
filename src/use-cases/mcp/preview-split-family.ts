import type { z } from 'zod'
import { dbArchived } from '@/lib/db'
import { familySplitChecksum, inspectFamilySplit } from '@/use-cases/families/split-family'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { previewSplitFamilySchema } from './schemas'

export const SPLIT_FAMILY_TOOL = 'split_family'

type Input = z.input<typeof previewSplitFamilySchema>

export async function previewSplitFamily(scope: DraftScope, input: Input) {
  const parsed = previewSplitFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { sourceId, personIds, name } = parsed.data
  const inspection = await inspectFamilySplit(dbArchived, { schoolId, sourceId, personIds })
  if (typeof inspection === 'string') {
    return blockedPreview({}, [], [{ field: 'family', value: '', reason: inspection }])
  }
  const { plan } = inspection
  const resolved = {
    tool: SPLIT_FAMILY_TOOL,
    name,
    ...plan,
    stateChecksum: familySplitChecksum(plan),
    effects: { newFamilyCreated: true, sourceRetained: true, parentAccountsStay: true },
  }
  return saveDraftPreview(scope, SPLIT_FAMILY_TOOL, resolved, {}, [], [])
}
