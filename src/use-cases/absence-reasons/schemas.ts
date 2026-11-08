import { z } from 'zod'
import { ABSENCE_REASON_LABEL_MAX, normalizeAbsenceReasonLabel } from '@/domain/absence-reason'

const label = z
  .string()
  .transform(normalizeAbsenceReasonLabel)
  .pipe(z.string().min(1).max(ABSENCE_REASON_LABEL_MAX))

export const createAbsenceReasonSchema = z.object({
  schoolId: z.string().min(1),
  label,
  justified: z.boolean(),
})

export const updateAbsenceReasonSchema = z
  .object({
    schoolId: z.string().min(1),
    id: z.uuid(),
    label: label.optional(),
    justified: z.boolean().optional(),
  })
  .refine((input) => input.label !== undefined || input.justified !== undefined)

export const archiveAbsenceReasonSchema = z.object({ schoolId: z.string().min(1), id: z.uuid() })

export const reorderAbsenceReasonsSchema = z.object({
  schoolId: z.string().min(1),
  ids: z.array(z.uuid()).min(1).max(50),
})
