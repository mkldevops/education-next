import { z } from 'zod'
import { MealService } from '@/generated/prisma/enums'

const service = z.enum(MealService)

export const setMealServiceSettingSchema = z.object({
  schoolId: z.string().min(1),
  service,
  isEnabled: z.boolean(),
  allowedWeekdays: z.array(z.number().int()),
})

export const setMealPriceSchema = z.object({
  schoolId: z.string().min(1),
  service,
  amount: z.number().positive(),
  effectiveFrom: z.iso.date(),
})

export const removeMealPriceSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})

const weekdays = z.array(z.number().int().min(1).max(7))

/** Un élève ou un membre du personnel : `mealOwner` refuse une saisie qui n'en nomme pas un seul. */
const studentService = {
  schoolId: z.string().min(1),
  studentId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  service,
}

export const subscribeMealSchema = z.object({
  ...studentService,
  periodId: z.uuid(),
  weekdays,
  startOn: z.iso.date(),
})

export const changeMealScheduleSchema = z.object({
  ...studentService,
  weekdays,
  effectiveFrom: z.iso.date(),
})

export const stopMealSchema = z.object({
  ...studentService,
  effectiveFrom: z.iso.date(),
})

export const recordMealOpeningSchema = z.object({
  ...studentService,
  paidThrough: z.iso.date(),
  reason: z.string().trim().min(1).max(250),
  recordedById: z.string().min(1),
})

export const toggleMealAbsenceSchema = z.object({
  ...studentService,
  day: z.iso.date(),
  absent: z.boolean(),
  recordedById: z.string().min(1),
})

export const mealImpactOfClosureSchema = z.object({
  schoolId: z.string().min(1),
  eventId: z.uuid().optional(),
  startAt: z.date(),
  endAt: z.date().nullable(),
  today: z.iso.date(),
})

const importName = { lastname: z.string().trim().min(1), name: z.string().trim().min(1) }

/** Fichier privé de reprise : noms et paiements restent hors du dépôt. */
export const mealImportManifestSchema = z.object({
  constatDate: z.iso.date(),
  requiredClosures: z.array(z.iso.date()).min(1),
  lines: z
    .array(
      z.object({
        ...importName,
        service,
        className: z.string().trim().min(1),
        aliases: z.array(z.object(importName)).optional(),
        studentId: z.uuid().optional(),
        weekdays: z.union([z.literal('usual'), weekdays.min(1)]),
        startOn: z.iso.date(),
        hold: z.string().trim().min(1).optional(),
        coverage: z.discriminatedUnion('state', [
          z.object({ state: z.literal('paid'), paidThrough: z.iso.date() }),
          z.object({ state: z.literal('unpaid') }),
          z.object({
            state: z.enum(['uncertain', 'unknown']),
            piece: z.string().trim().min(1),
            proposedPaidThrough: z.iso.date().optional(),
          }),
        ]),
        familyCode: z.string().trim().min(1).optional(),
        water: z.boolean().optional(),
        note: z.string().trim().min(1).optional(),
      })
    )
    .min(1),
})

export const dailyMealHeadcountSchema = z.object({
  schoolId: z.string().min(1),
  day: z.iso.date(),
})
