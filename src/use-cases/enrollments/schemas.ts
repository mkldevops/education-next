import { z } from 'zod'

export const createEnrollmentSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().uuid(),
  planId: z.string().uuid(),
  classPeriodId: z.string().uuid(),
  discount: z.number().min(0).default(0),
  canLeaveAlone: z.boolean().default(false),
})

export const enrollmentIdSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
})

export const reassignClassSchema = z.object({
  schoolId: z.string().min(1),
  enrollmentId: z.string().uuid(),
  newClassPeriodId: z.string().uuid(),
})

export const applyDiscountSchema = z.object({
  schoolId: z.string().min(1),
  enrollmentId: z.string().uuid(),
  discount: z.number().min(0),
})

export const promoteStudentsSchema = z.object({
  schoolId: z.string().min(1),
  sourcePeriodId: z.string().uuid(),
  targetPeriodId: z.string().uuid(),
})
