import { z } from 'zod'
import { isCurrencyAmount } from '@/domain/enrollment'
import { startMonthSchema } from '@/domain/payment-schedule'

export const createEnrollmentSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().uuid(),
  // Facultatif : coupure des paiements, la formule réservée est résolue côté serveur
  // (FR-017). Un appelant qui en fournit une malgré tout est refusé, pas ignoré.
  planId: z.string().uuid().optional(),
  classPeriodId: z.string().uuid(),
  totalAmount: z.number().min(0).refine(isCurrencyAmount).optional(),
  discount: z.number().min(0).default(0),
  canLeaveAlone: z.boolean().default(false),
  /** Annule l'inscription en cours de la même période au lieu de refuser le doublon. */
  replaceExisting: z.boolean().default(false),
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
  discount: z.number().min(0).default(0),
  totalAmount: z.number().min(0).refine(isCurrencyAmount).optional(),
})

export const setEnrollmentPlanSchema = z.object({
  schoolId: z.string().min(1),
  enrollmentId: z.string().uuid(),
  planId: z.string().uuid(),
})

export const setEnrollmentStartMonthSchema = z.object({
  schoolId: z.string().min(1),
  enrollmentId: z.string().uuid(),
  /** `YYYY-MM` ; `null` rend l'inscription due depuis le début de sa période. */
  startMonth: startMonthSchema.nullable(),
})

export const promoteStudentsSchema = z.object({
  schoolId: z.string().min(1),
  sourcePeriodId: z.string().uuid(),
  targetPeriodId: z.string().uuid(),
  /** Niveau choisi par inscription source, pour les niveaux qui mènent à plusieurs niveaux. */
  nextLevelChoices: z.record(z.uuid(), z.uuid()).default({}),
})
