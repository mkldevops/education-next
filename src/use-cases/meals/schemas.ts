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
