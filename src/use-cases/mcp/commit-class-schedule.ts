import { z } from 'zod'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY } from '@/lib/class-schedule-config'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { claimResolved, commitInTransaction } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { CLASS_SCHEDULE_TOOL } from './preview-class-schedule'
import { commitDraftSchema } from './schemas'

const resolvedSchema = z.object({
  period: z.object({ id: z.string(), name: z.string() }),
  slots: z
    .array(
      z.object({
        classPeriod: z.object({ id: z.string(), name: z.string() }),
        weekday: z.number().int(),
        startTime: z.string(),
        endTime: z.string(),
        description: z.string().nullable(),
        teachers: z.array(
          z.object({ id: z.string(), firstName: z.string(), lastName: z.string() })
        ),
      })
    )
    .min(1),
})

type Input = z.infer<typeof commitDraftSchema>

type SlotWarning = { type: 'teacherOverlap'; slotIds: string[] }

export async function commitClassSchedule(scope: DraftScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  // Refuse même un brouillon préparé avant la coupure, sans le réclamer — un `claimDraft`
  // marquerait un brouillon désormais inengageable.
  if (!(await isClassScheduleEnabled(schoolId))) return 'notConfigured' as const

  const claim = await claimResolved(scope, CLASS_SCHEDULE_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { draftId, resolved } = claim

  return commitInTransaction(schoolId, draftId, async (tx) => {
    // Classes et affectations sont relues dans la transaction, pas seulement au preview :
    // une classe archivée ou un enseignant retiré entre-temps refuse tout le lot avant la
    // première écriture, comme le ferait l'outil unitaire.
    const classIds = [...new Set(resolved.slots.map((slot) => slot.classPeriod.id))]
    const classes = await tx.classPeriod.findMany({
      where: { schoolId, id: { in: classIds }, periodId: resolved.period.id, isActive: true },
      select: {
        id: true,
        teachers: { where: { teacher: { isActive: true } }, select: { teacherId: true } },
      },
    })
    if (classes.length !== classIds.length) return 'notFound' as const

    const assignedByClass = new Map(
      classes.map((row) => [row.id, new Set(row.teachers.map((t) => t.teacherId))])
    )
    for (const slot of resolved.slots) {
      const assigned = assignedByClass.get(slot.classPeriod.id)
      if (slot.teachers.some((teacher) => !assigned?.has(teacher.id))) {
        return 'teacherNotFound' as const
      }
    }

    const overlapConfig = await tx.config.findFirst({
      where: { schoolId, name: CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY },
      select: { value: true },
    })

    const saved = await classScheduleGateway.createManyWithOverlapValidation(
      tx,
      schoolId,
      resolved.slots.map((slot) => ({
        classPeriodId: slot.classPeriod.id,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        description: slot.description,
        teacherIds: slot.teachers.map((teacher) => teacher.id),
      })),
      overlapConfig?.value !== 'false'
    )
    if (saved.status !== 'OK') return saved.status

    return {
      periodId: resolved.period.id,
      slots: saved.slots.map((slot) => {
        const warnings: SlotWarning[] =
          slot.teacherOverlapIds.length > 0
            ? [{ type: 'teacherOverlap', slotIds: slot.teacherOverlapIds }]
            : []
        return { id: slot.id, warnings }
      }),
    }
  })
}
