import { z } from 'zod'
import { mcpPaymentMethodSchema, mcpSexSchema } from '@/use-cases/mcp/schemas'

/**
 * Ce que le modèle a le droit de proposer : une lecture **partielle** de la fiche.
 *
 * Tout est facultatif et lâche, à l'inverse de `previewEnrollFamilySchema` : un modèle
 * qui ne lit pas un e-mail doit pouvoir le laisser vide plutôt que l'inventer pour
 * satisfaire un `z.email()`. La rigueur revient à l'aperçu, une fois l'humain passé sur
 * le formulaire. Les seules bornes sont des longueurs, pour qu'une réponse dégénérée
 * ne remplisse pas l'écran.
 *
 * Le schéma est converti en JSON Schema pour l'outil : ni `z.coerce`, ni `z.date()`.
 */
const text = (max: number) => z.string().max(max).optional()

const proposedPersonSchema = z.object({
  name: text(250),
  lastname: text(250),
  sex: mcpSexSchema.optional(),
})

const proposedParentSchema = proposedPersonSchema.extend({
  email: text(250),
  phoneNumber: text(40),
})

const proposedStudentSchema = proposedPersonSchema.extend({
  /** Jour ISO `AAAA-MM-JJ` tel que lu ; validé à l'aperçu. */
  birthday: text(10),
  birthplace: text(250),
  className: text(250),
  planName: text(50),
})

const proposedPaymentSchema = z.object({
  amount: z.number().optional(),
  method: mcpPaymentMethodSchema.optional(),
  reference: text(250),
  /** Jour ISO ou horodatage tel que lu. */
  paidAt: text(40),
})

export const MISSING_FIELD_REASONS = ['missing', 'illegible', 'ambiguous'] as const

const missingFieldSchema = z.object({
  /** Chemin du champ, ex. `students.0.birthday`. */
  field: z.string().max(80),
  reason: z.enum(MISSING_FIELD_REASONS),
  note: text(250),
})

export const enrollmentProposalSchema = z.object({
  familyName: text(50),
  parents: z.array(proposedParentSchema).max(4).optional(),
  students: z.array(proposedStudentSchema).max(10).optional(),
  emergencyContactName: text(250),
  emergencyContactPhone: text(40),
  planName: text(50),
  discount: z.number().min(0).optional(),
  payment: proposedPaymentSchema.optional(),
  missing: z.array(missingFieldSchema).max(40).optional(),
  notes: text(1000),
})

export type EnrollmentProposal = z.infer<typeof enrollmentProposalSchema>

export const PROPOSE_ENROLLMENT_TOOL = 'propose_enrollment'
