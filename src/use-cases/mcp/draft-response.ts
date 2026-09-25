import { draftExpiry, type McpFinding } from '@/domain/mcp-draft'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import type { DraftScope } from './draft-scope'

export function blockedPreview<M>(matches: M, warnings: McpFinding[], blockers: McpFinding[]) {
  return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
}

export async function saveDraftPreview<R extends Prisma.InputJsonValue, M>(
  scope: Pick<DraftScope, 'schoolId' | 'owner'>,
  tool: string,
  resolved: R,
  matches: M,
  warnings: McpFinding[],
  blockers: McpFinding[]
) {
  const checksum = draftChecksum(resolved)
  const draft = await mcpDraftGateway.create(scope.schoolId, {
    owner: scope.owner,
    tool,
    checksum,
    resolved,
    expiresAt: draftExpiry(),
  })

  return { draftId: draft.id, checksum, plan: resolved, matches, warnings, blockers }
}
