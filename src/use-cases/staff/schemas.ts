import { z } from 'zod'
import { MealService } from '@/generated/prisma/enums'

const fields = {
  name: z.string().trim().min(1).max(250),
  note: z.string().trim().max(250).optional(),
  mealExempt: z.boolean(),
}

export const createStaffMemberSchema = z.object({ schoolId: z.string().min(1), ...fields })

export const updateStaffMemberSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  ...fields,
  isActive: z.boolean(),
})

export const recordStaffReceiptSchema = z.object({
  schoolId: z.string().min(1),
  recordedById: z.string().min(1),
  idempotencyKey: z.uuid(),
  staffMemberId: z.uuid(),
  service: z.enum(MealService),
  amount: z.number().positive(),
  expectedPaidThrough: z.iso.date().nullable(),
  method: z.enum(['CASH', 'MOBILE_MONEY', 'TRANSFER', 'CHECK']),
  reference: z.string().trim().max(250).optional(),
})
