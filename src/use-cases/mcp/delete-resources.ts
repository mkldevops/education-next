import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { deactivateClassPeriod } from '@/use-cases/class-periods/deactivate-class-period'
import { deleteFamily } from '@/use-cases/families/delete-family'
import { deactivateLevel } from '@/use-cases/levels/deactivate-level'
import { deactivatePlan } from '@/use-cases/plans/deactivate-plan'
import { deactivateStudent } from '@/use-cases/students/deactivate-student'
import { mcpDeleteFamilySchema, mcpResourceIdSchema } from './schemas'

type Scope = { schoolId: string }
type ResourceInput = z.input<typeof mcpResourceIdSchema>
type Archive = (input: { schoolId: string; id: string }) => Promise<string>

export async function getFamilyDeletionImpactFromMcp(
  scope: Scope,
  input: ResourceInput,
  families: Pick<
    typeof familyGateway,
    'findByIdIncludingArchived' | 'countDeletionImpact'
  > = familyGateway
) {
  const parsed = mcpResourceIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const family = await families.findByIdIncludingArchived(scope.schoolId, parsed.data.id)
  if (!family) return 'notFound' as const
  const impact = await families.countDeletionImpact(scope.schoolId, family.id)
  return { family, impact }
}

export async function deleteFamilyFromMcp(
  scope: Scope,
  input: z.input<typeof mcpDeleteFamilySchema>,
  remove = deleteFamily
) {
  const parsed = mcpDeleteFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const result = await remove({ ...parsed.data, schoolId: scope.schoolId })
  return result === 'OK' ? { id: parsed.data.id, deleted: true } : result
}

async function archiveResource(scope: Scope, input: ResourceInput, archive: Archive) {
  const parsed = mcpResourceIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const result = await archive({ ...parsed.data, schoolId: scope.schoolId })
  return result === 'OK' ? { id: parsed.data.id, archived: true } : result
}

export function archiveStudentFromMcp(
  scope: Scope,
  input: ResourceInput,
  archive: Archive = deactivateStudent
) {
  return archiveResource(scope, input, archive)
}

export function archiveClassPeriodFromMcp(
  scope: Scope,
  input: ResourceInput,
  archive: Archive = deactivateClassPeriod
) {
  return archiveResource(scope, input, archive)
}

export function archiveLevelFromMcp(
  scope: Scope,
  input: ResourceInput,
  archive: Archive = deactivateLevel
) {
  return archiveResource(scope, input, archive)
}

export function archivePlanFromMcp(
  scope: Scope,
  input: ResourceInput,
  archive: Archive = deactivatePlan
) {
  return archiveResource(scope, input, archive)
}
