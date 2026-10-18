import { z } from 'zod'
import { isCurrencyAmount } from '@/domain/enrollment'
import { personInputSchema } from '../families/schemas'

export const studentInputSchema = z.object({
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

/**
 * Inscription optionnelle demandée en même temps que la création de l'élève.
 *
 * Volontairement plus étroit que `createEnrollmentSchema` : un élève qui vient d'être créé
 * n'a aucune inscription à remplacer, donc `replaceExisting` n'a pas de sens ici.
 */
export const newStudentEnrollmentSchema = z.object({
  // Facultatif pour la même raison que `createEnrollmentSchema.planId` : une école qui a
  // coupé les paiements inscrit sans formule, et le use case restaure l'obligation drapeau actif.
  planId: z.string().uuid().optional(),
  classPeriodId: z.string().uuid(),
  totalAmount: z.number().min(0).refine(isCurrencyAmount).optional(),
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
