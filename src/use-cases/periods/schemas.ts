import { z } from 'zod'

export const createPeriodSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(50),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
})

export const updatePeriodSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
})

export const deactivatePeriodSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
})
