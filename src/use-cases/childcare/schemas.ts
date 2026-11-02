import { z } from 'zod'
import { isChildcareMonth } from '@/domain/childcare'

const monthSchema = z.string().refine(isChildcareMonth)

export const saveChildcareSubscriptionSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
  monthlyAmount: z.number().positive(),
  startMonth: monthSchema,
  endMonth: monthSchema.nullable(),
})

export const removeChildcareSubscriptionSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
})

export const billChildcareMonthSchema = z.object({
  schoolId: z.string().min(1),
  recordedById: z.string().min(1),
  month: monthSchema,
})

export const cancelChildcareChargeSchema = z.object({
  schoolId: z.string().min(1),
  cancelledById: z.string().min(1),
  chargeId: z.uuid(),
  reason: z.string().trim().min(1).max(250),
})
