import type { z } from 'zod'
import { sameAbsenceReasonLabel } from '@/domain/absence-reason'
import { absenceReasonGateway } from '@/gateways/absence-reason-gateway'
import {
  archiveAbsenceReasonSchema,
  createAbsenceReasonSchema,
  reorderAbsenceReasonsSchema,
  updateAbsenceReasonSchema,
} from './schemas'

/** Enough for any school; keeps the reason chips on one or two lines at the call. */
export const MAX_ABSENCE_REASONS = 20

type Gateway = typeof absenceReasonGateway

export async function createAbsenceReason(
  input: z.input<typeof createAbsenceReasonSchema>,
  gateway: Gateway = absenceReasonGateway
) {
  const parsed = createAbsenceReasonSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, label, justified } = parsed.data
  const reasons = await gateway.listActive(schoolId)
  if (reasons.length >= MAX_ABSENCE_REASONS) return 'tooManyReasons' as const
  if (reasons.some((reason) => sameAbsenceReasonLabel(reason.label, label)))
    return 'labelTaken' as const
  const position = reasons.reduce((max, reason) => Math.max(max, reason.position + 1), 0)
  return gateway.create(schoolId, { label, justified, position })
}

export async function updateAbsenceReason(
  input: z.input<typeof updateAbsenceReasonSchema>,
  gateway: Gateway = absenceReasonGateway
) {
  const parsed = updateAbsenceReasonSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, id, label, justified } = parsed.data
  if (label !== undefined) {
    const reasons = await gateway.listActive(schoolId)
    if (reasons.some((reason) => reason.id !== id && sameAbsenceReasonLabel(reason.label, label)))
      return 'labelTaken' as const
  }
  const updated = await gateway.update(schoolId, id, { label, justified })
  return updated === 1 ? ('OK' as const) : ('notFound' as const)
}

/** Archived, never deleted: past calls keep pointing at it and show their frozen label. */
export async function archiveAbsenceReason(
  input: z.input<typeof archiveAbsenceReasonSchema>,
  gateway: Gateway = absenceReasonGateway
) {
  const parsed = archiveAbsenceReasonSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const archived = await gateway.archive(parsed.data.schoolId, parsed.data.id)
  return archived === 1 ? ('OK' as const) : ('notFound' as const)
}

/** The new order must name exactly the school's active reasons, each once. */
export async function reorderAbsenceReasons(
  input: z.input<typeof reorderAbsenceReasonsSchema>,
  gateway: Gateway = absenceReasonGateway
) {
  const parsed = reorderAbsenceReasonsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, ids } = parsed.data
  const active = new Set((await gateway.listActive(schoolId)).map((reason) => reason.id))
  if (new Set(ids).size !== ids.length || ids.length !== active.size) return 'staleOrder' as const
  if (ids.some((id) => !active.has(id))) return 'staleOrder' as const
  await gateway.reorder(schoolId, ids)
  return 'OK' as const
}
