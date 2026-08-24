import { z } from 'zod'

export const createClassPeriodSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
  capacity: z.number().int().positive(),
  levelId: z.string().uuid(),
  periodId: z.string().uuid(),
})

export const updateClassPeriodSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(250).optional(),
  capacity: z.number().int().positive().optional(),
})
