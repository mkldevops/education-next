import { z } from 'zod'
import { personInputSchema } from '../families/schemas'

const studentInputSchema = z.object({
  birthday: z.coerce.date().nullish(),
  birthplace: z.string().max(250).optional(),
  previousSchool: z.string().max(250).optional(),
  healthNotes: z.string().optional(),
  snackAuthorization: z.boolean().default(false),
  allergies: z.string().max(250).optional(),
})

export const createStudentSchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  person: personInputSchema,
  student: studentInputSchema,
})

export const updateStudentSchema = z
  .object({
    schoolId: z.string().min(1),
    id: z.string().uuid(),
  })
  .merge(studentInputSchema.partial())
