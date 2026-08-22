import { z } from 'zod'

export const createPlanSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(50),
  amount: z.number().positive(),
})

export const updatePlanSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  amount: z.number().positive().optional(),
})
