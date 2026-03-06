import { z } from 'zod'

export const createPlanSchema = z.object({
  name: z.string().min(1).max(50),
  amount: z.number().positive(),
})
