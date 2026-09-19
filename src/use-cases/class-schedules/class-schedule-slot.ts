import type { z } from 'zod'
import { validateWeeklyTimeRange } from '@/domain/class-schedule'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY } from '@/lib/class-schedule-config'
import { isClassScheduleEnabled } from './is-class-schedule-enabled'
import {
  createClassScheduleSlotSchema,
  deleteClassScheduleSlotSchema,
  updateClassScheduleSlotSchema,
} from './schemas'

type CreateInput = z.input<typeof createClassScheduleSlotSchema>
type UpdateInput = z.input<typeof updateClassScheduleSlotSchema>
type DeleteInput = z.input<typeof deleteClassScheduleSlotSchema>
type ScheduleGateway = typeof classScheduleGateway
type ClassPeriodGateway = typeof classPeriodGateway
type ConfigGateway = typeof configGateway

type SlotData = {
  classPeriodId: string
  weekday: number
  startTime: string
  endTime: string
  description?: string | null
  teacherIds: string[]
}

type SlotWarning = { type: 'teacherOverlap'; slotIds: string[] }

function toSlotResult(saved: Awaited<ReturnType<ScheduleGateway['saveWithOverlapValidation']>>) {
  if (saved.status !== 'OK') return saved.status
  const warnings: SlotWarning[] =
    saved.teacherOverlapIds.length > 0
      ? [{ type: 'teacherOverlap', slotIds: saved.teacherOverlapIds }]
      : []
  return { slot: saved.slot, warnings }
}

async function validateSlot(
  schoolId: string,
  data: SlotData,
  classPeriodGw: ClassPeriodGateway,
  configGw: ConfigGateway
): Promise<
  | 'notConfigured'
  | 'classPeriodNotFound'
  | 'teacherNotFound'
  | 'invalidTimeRange'
  | 'classOverlap'
  | 'teacherOverlap'
  | { teacherOverlapAllowed: boolean }
> {
  if (!(await isClassScheduleEnabled(schoolId, configGw))) return 'notConfigured'

  if (validateWeeklyTimeRange(data) !== 'OK') return 'invalidTimeRange'

  const classPeriod = await classPeriodGw.findById(schoolId, data.classPeriodId)
  if (!classPeriod) return 'classPeriodNotFound'

  const assignedTeacherIds = new Set(
    classPeriod.teachers.map((assignment) => assignment.teacher.id)
  )
  if (data.teacherIds.some((teacherId) => !assignedTeacherIds.has(teacherId)))
    return 'teacherNotFound'

  const overlapConfig = await configGw.get(
    schoolId,
    CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY
  )
  return { teacherOverlapAllowed: overlapConfig?.value !== 'false' }
}

export async function createClassScheduleSlot(
  input: CreateInput,
  scheduleGw: ScheduleGateway = classScheduleGateway,
  classPeriodGw: ClassPeriodGateway = classPeriodGateway,
  configGw: ConfigGateway = configGateway
) {
  const parsed = createClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  const validation = await validateSlot(schoolId, data, classPeriodGw, configGw)
  if (typeof validation === 'string') return validation

  const saved = await scheduleGw.saveWithOverlapValidation(
    schoolId,
    data,
    validation.teacherOverlapAllowed
  )
  return toSlotResult(saved)
}

export async function updateClassScheduleSlot(
  input: UpdateInput,
  scheduleGw: ScheduleGateway = classScheduleGateway,
  classPeriodGw: ClassPeriodGateway = classPeriodGateway,
  configGw: ConfigGateway = configGateway
) {
  const parsed = updateClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  const existing = await scheduleGw.findById(schoolId, id)
  if (!existing) return 'notFound' as const

  const validation = await validateSlot(schoolId, data, classPeriodGw, configGw)
  if (typeof validation === 'string') return validation

  const saved = await scheduleGw.saveWithOverlapValidation(
    schoolId,
    data,
    validation.teacherOverlapAllowed,
    id
  )
  return toSlotResult(saved)
}

export async function deleteClassScheduleSlot(
  input: DeleteInput,
  scheduleGw: ScheduleGateway = classScheduleGateway,
  configGw: ConfigGateway = configGateway
) {
  const parsed = deleteClassScheduleSlotSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id } = parsed.data
  if (!(await isClassScheduleEnabled(schoolId, configGw))) return 'notConfigured' as const

  const slot = await scheduleGw.findById(schoolId, id)
  if (!slot) return 'notFound' as const
  await scheduleGw.delete(schoolId, id)
  return 'OK' as const
}
