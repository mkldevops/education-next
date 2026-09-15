import { z } from 'zod'
import { personInputSchema } from '../families/schemas'

const studentInputSchema = z.object({
  birthday: z.coerce.date().nullish(),
  birthplace: z.string().max(250).optional(),
  previousSchool: z.string().max(250).optional(),
  healthNotes: z.string().optional(),
  languagesAtHome: z.array(z.string()).default([]),
  snackAuthorization: z.boolean().default(false),
  allergies: z.string().max(250).optional(),
})

export const createStudentSchema = z.object({
  schoolId: z.string().min(1),
  familyId: z.string().uuid(),
  person: personInputSchema,
  student: studentInputSchema,
})

/**
 * Inscription optionnelle demandée en même temps que la création de l'élève.
 *
 * Volontairement plus étroit que `createEnrollmentSchema` : un élève qui vient d'être créé
 * n'a aucune inscription à remplacer, donc `replaceExisting` n'a pas de sens ici.
 */
const newStudentEnrollmentSchema = z.object({
  planId: z.string().uuid(),
  classPeriodId: z.string().uuid(),
  discount: z.number().min(0).default(0),
  canLeaveAlone: z.boolean().default(false),
})

export const createEnrolledStudentSchema = createStudentSchema.extend({
  enrollment: newStudentEnrollmentSchema,
})

export const updateStudentSchema = z
  .object({
    schoolId: z.string().min(1),
    id: z.string().uuid(),
  })
  .merge(studentInputSchema.partial())
