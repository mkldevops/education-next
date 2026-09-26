import { z } from 'zod'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import {
  createClassScheduleSlot,
  deleteClassScheduleSlot,
  updateClassScheduleSlot,
} from '@/use-cases/class-schedules/class-schedule-slot'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import type { McpScope } from './resolve-mcp-scope'
import {
  mcpCreateClassScheduleSlotSchema,
  mcpDeleteClassScheduleSlotSchema,
  mcpListClassScheduleSlotsSchema,
  mcpUpdateClassScheduleSlotSchema,
} from './schemas'

type Scope = Pick<McpScope, 'schoolId'>

export async function listClassScheduleSlotsFromMcp(
  scope: Scope,
  input: z.infer<typeof mcpListClassScheduleSlotsSchema>
) {
  const parsed = mcpListClassScheduleSlotsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!(await isClassScheduleEnabled(scope.schoolId))) return 'notConfigured' as const
  return mcpReadGateway.listClassScheduleSlots(scope.schoolId, parsed.data.periodId)
}

function createdSlotResult(
  result:
    | Awaited<ReturnType<typeof createClassScheduleSlot>>
    | Awaited<ReturnType<typeof updateClassScheduleSlot>>
) {
  if (typeof result === 'string') return result
  return { id: z.object({ id: z.uuid() }).parse(result.slot).id, warnings: result.warnings }
}

export async function createClassScheduleSlotFromMcp(
  scope: Scope,
  input: z.infer<typeof mcpCreateClassScheduleSlotSchema>
) {
  const parsed = mcpCreateClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  return createdSlotResult(
    await createClassScheduleSlot({ ...parsed.data, schoolId: scope.schoolId })
  )
}

export async function updateClassScheduleSlotFromMcp(
  scope: Scope,
  input: z.infer<typeof mcpUpdateClassScheduleSlotSchema>
) {
  const parsed = mcpUpdateClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!(await isClassScheduleEnabled(scope.schoolId))) return 'notConfigured' as const
  const existing = await classScheduleGateway.findById(scope.schoolId, parsed.data.id)
  if (!existing) return 'notFound' as const
  return createdSlotResult(
    await updateClassScheduleSlot({
      ...parsed.data,
      classPeriodId: existing.classPeriodId,
      schoolId: scope.schoolId,
    })
  )
}

export async function deleteClassScheduleSlotFromMcp(
  scope: Scope,
  input: z.infer<typeof mcpDeleteClassScheduleSlotSchema>
) {
  const parsed = mcpDeleteClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const result = await deleteClassScheduleSlot({ ...parsed.data, schoolId: scope.schoolId })
  return result === 'OK' ? { deleted: true } : result
}
