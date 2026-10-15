import { z } from 'zod'

export const createTeacherSchema = z.object({
  schoolId: z.string().min(1),
  firstName: z.string().trim().min(1).max(250),
  lastName: z.string().trim().max(250).default(''),
  email: z.preprocess(
    (value) => (value === '' ? null : value),
    z.email().max(250).nullable().optional()
  ),
  phone: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().max(20).nullable().optional()
  ),
})

export const updateTeacherSchema = createTeacherSchema
  .extend({ id: z.uuid(), lastName: z.string().trim().max(250) })
  .partial({ firstName: true, lastName: true, email: true, phone: true })
  .required({ schoolId: true, id: true })

export const createTeacherExpenseSchema = z.object({
  schoolId: z.string().min(1),
  teacherId: z.uuid(),
  amount: z.number().positive(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(250),
  requestedAt: z.date(),
  paidAt: z.date().nullable().optional(),
})

export const teacherLifecycleSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})
