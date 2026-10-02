import { z } from 'zod'

const teacherIdsSchema = z
  .array(z.string().uuid())
  .refine((ids) => new Set(ids).size === ids.length)

export const createClassPeriodSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
  capacity: z.number().int().positive(),
  levelId: z.string().uuid(),
  periodId: z.string().uuid(),
  teacherIds: teacherIdsSchema.default([]),
})

export const updateClassPeriodSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(250).optional(),
  capacity: z.number().int().positive().optional(),
  levelId: z.string().uuid().optional(),
  teacherIds: teacherIdsSchema.optional(),
})

export const assignClassPeriodTeacherSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
})

export const unassignClassPeriodTeacherSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
})

export const deactivateClassPeriodSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
})
