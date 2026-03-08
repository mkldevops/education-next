import { z } from 'zod'
import { personInputSchema } from '../families/schemas'

const studentInputSchema = z.object({
  birthday: z.coerce.date(),
  birthplace: z.string().max(250).optional(),
  previousSchool: z.string().max(250).optional(),
  healthNotes: z.string().optional(),
  languagesAtHome: z.array(z.string()).default([]),
  snackAuthorization: z.boolean().default(false),
  allergies: z.string().max(250).optional(),
})

export const createStudentSchema = z.object({
  familyId: z.string().uuid(),
  person: personInputSchema,
  student: studentInputSchema,
})

export const updateStudentSchema = z
  .object({
    id: z.string().uuid(),
  })
  .merge(studentInputSchema.partial())
