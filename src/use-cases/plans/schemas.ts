import { z } from 'zod'
import { isCurrencyAmount } from '@/domain/enrollment'
import {
  annualPlanAmount,
  paymentScheduleSchema,
  planPricingSchema,
} from '@/domain/payment-schedule'

const amountSchema = z.number().positive().max(99_999_999.99).refine(isCurrencyAmount)

function consistentPricing(data: { amount?: number; pricing?: z.infer<typeof planPricingSchema> }) {
  return (
    !data.pricing || data.amount === undefined || data.amount === annualPlanAmount(data.pricing)
  )
}

export const createPlanSchema = z
  .object({
    schoolId: z.string().min(1),
    name: z.string().min(1).max(50),
    amount: amountSchema.optional(),
    pricing: planPricingSchema.optional(),
    paymentSchedule: paymentScheduleSchema.optional(),
  })
  .refine((data) => data.amount !== undefined || data.pricing !== undefined)
  .refine(consistentPricing)

export const updatePlanSchema = z
  .object({
    schoolId: z.string().min(1),
    id: z.uuid(),
    name: z.string().min(1).max(50).optional(),
    amount: amountSchema.optional(),
    pricing: planPricingSchema.optional(),
    paymentSchedule: paymentScheduleSchema.optional(),
  })
  .refine(consistentPricing)

export const deactivatePlanSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})
