import { z } from 'zod'
import { newStudentEnrollmentSchema, studentInputSchema } from '@/use-cases/students/schemas'
import { createFamilySchema, personInputSchema } from './schemas'

/**
 * Parcours « Créer une famille ». Hors de `schemas.ts` : `students/schemas.ts` importe déjà
 * `personInputSchema` de ce dossier, et le dialogue client relit ce schéma sans charger `db`.
 */
const newChildSchema = z.object({
  person: personInputSchema,
  student: studentInputSchema,
  enrollment: newStudentEnrollmentSchema.optional(),
})

export const createFullFamilySchema = createFamilySchema.extend({
  students: z.array(newChildSchema).max(20).default([]),
})
