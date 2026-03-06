import { z } from 'zod'

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  planId: z.string().uuid(),
  classPeriodId: z.string().uuid(),
  discount: z.number().min(0).default(0),
  canLeaveAlone: z.boolean().default(false),
})

export const enrollmentIdSchema = z.object({
  id: z.string().uuid(),
})

export const reassignClassSchema = z.object({
  enrollmentId: z.string().uuid(),
  newClassPeriodId: z.string().uuid(),
})

export const applyDiscountSchema = z.object({
  enrollmentId: z.string().uuid(),
  discount: z.number().min(0),
})
