import { z } from 'zod'
import { MealService } from '@/generated/prisma/enums'

export const setStaffMealExemptSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  mealExempt: z.boolean(),
})

export const recordStaffReceiptSchema = z.object({
  schoolId: z.string().min(1),
  recordedById: z.string().min(1),
  idempotencyKey: z.uuid(),
  teacherId: z.uuid(),
  service: z.enum(MealService),
  amount: z.number().positive(),
  expectedPaidThrough: z.iso.date().nullable(),
  method: z.enum(['CASH', 'MOBILE_MONEY', 'TRANSFER', 'CHECK']),
  reference: z.string().trim().max(250).optional(),
})
