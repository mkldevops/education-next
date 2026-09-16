import { z } from 'zod'

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const teacherIdsSchema = z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length)
const descriptionSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(500).nullable().optional()
)

const slotDataSchema = z.object({
  classPeriodId: z.uuid(),
  weekday: z.number().int().min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
  description: descriptionSchema,
  teacherIds: teacherIdsSchema,
})

export const createClassScheduleSlotSchema = slotDataSchema.extend({
  schoolId: z.string().min(1),
})

export const updateClassScheduleSlotSchema = slotDataSchema.extend({
  schoolId: z.string().min(1),
  id: z.uuid(),
})

export const deleteClassScheduleSlotSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})
