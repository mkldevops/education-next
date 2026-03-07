import { z } from 'zod'

export const createPlanSchema = z.object({
  name: z.string().min(1).max(50),
  amount: z.number().positive(),
})

export const updatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  amount: z.number().positive().optional(),
})
