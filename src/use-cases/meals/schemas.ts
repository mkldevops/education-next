import { z } from 'zod'
import { MealService } from '@/generated/prisma/enums'

const service = z.enum(MealService)

export const setMealServiceSettingSchema = z.object({
  schoolId: z.string().min(1),
  service,
  isEnabled: z.boolean(),
  allowedWeekdays: z.array(z.number().int()),
})

export const setMealPriceSchema = z.object({
  schoolId: z.string().min(1),
  service,
  amount: z.number().positive(),
  effectiveFrom: z.iso.date(),
})

export const removeMealPriceSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})

const weekdays = z.array(z.number().int().min(1).max(7))

const studentService = {
  schoolId: z.string().min(1),
  studentId: z.uuid(),
  service,
}

export const subscribeMealSchema = z.object({
  ...studentService,
  periodId: z.uuid(),
  weekdays,
  startOn: z.iso.date(),
})

export const changeMealScheduleSchema = z.object({
  ...studentService,
  weekdays,
  effectiveFrom: z.iso.date(),
})

export const stopMealSchema = z.object({
  ...studentService,
  effectiveFrom: z.iso.date(),
})

export const recordMealOpeningSchema = z.object({
  ...studentService,
  paidThrough: z.iso.date(),
  reason: z.string().trim().min(1).max(250),
  recordedById: z.string().min(1),
})

export const toggleMealAbsenceSchema = z.object({
  ...studentService,
  day: z.iso.date(),
  absent: z.boolean(),
  recordedById: z.string().min(1),
})

export const mealImpactOfClosureSchema = z.object({
  schoolId: z.string().min(1),
  eventId: z.uuid().optional(),
  startAt: z.date(),
  endAt: z.date().nullable(),
  today: z.iso.date(),
})
