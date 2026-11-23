'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { attendanceOccurrenceKey } from '@/domain/attendance-frequency'
import { missingRosterStudents, planCancellationTransition } from '@/domain/attendance-session'
import { planningWeekday } from '@/domain/current-week-dates'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { absenceReasonGateway } from '@/gateways/absence-reason-gateway'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { isActiveSchoolAdmin } from '@/lib/school-context'
import {
  findRoster,
  refreshSessionRoster,
  rosterEntry,
} from '@/use-cases/attendance/attendance-roster'
import { getAttendanceEntrySettings } from '@/use-cases/config/get-attendance-entry-settings'
import { getAttendanceFrequency } from '@/use-cases/config/get-attendance-frequency'
import { syncMealAbsencesFromAttendance } from '@/use-cases/meals/sync-meal-absences-from-attendance'
import { requireSchoolAdmin, requireSchoolSession, requireTeacher } from './auth-helper'

const DAY_MS = 24 * 60 * 60 * 1000
const utcDay = z.coerce
  .date()
  .transform((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))

const openSchema = z.object({
  classPeriodId: z.uuid(),
  classScheduleSlotId: z.uuid(),
  occurredOn: utcDay,
})
const openAdhocSchema = z.object({
  classPeriodId: z.uuid(),
  occurredOn: utcDay,
})
const updateSchema = z.object({
  sessionId: z.uuid(),
  entryId: z.uuid(),
  status: z.enum(['NOT_RECORDED', 'PRESENT', 'ABSENT', 'LATE']),
  // Omitted fields preserve existing values for callers using the pre-R2 payload.
  lateMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
  absenceReasonId: z.uuid().nullable().optional(),
})
const sessionSchema = z.object({ sessionId: z.uuid() })
const cancellationSchema = z.object({ sessionId: z.uuid(), cancelled: z.boolean() })

const SESSION_WITH_ENTRIES = { entries: { orderBy: { studentName: 'asc' } } } as const

async function canOperateClass(classPeriodId: string) {
  const context = await requireSchoolSession()
  if (isActiveSchoolAdmin(context)) {
    const classPeriod = await db.classPeriod.findFirst({
      where: { id: classPeriodId, schoolId: context.schoolId },
      select: { id: true },
    })
    if (!classPeriod) return null
    return { schoolId: context.schoolId, userId: context.userId }
  }
  const teacher = await requireTeacher()
  const assignment = await db.classPeriodTeacher.findFirst({
    where: { schoolId: teacher.schoolId, classPeriodId, teacherId: teacher.teacherId },
    select: { teacherId: true },
  })
  if (!assignment) return null
  return { schoolId: teacher.schoolId, userId: teacher.userId }
}

async function enabled(schoolId: string) {
  const config = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  return readsAsOptedIn(config?.value)
}

function isUniqueConstraint(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

async function resolveOperableSession(sessionId: string) {
  const context = await requireSchoolSession()
  const session = await db.attendanceSession.findUnique({
    where: { id_schoolId: { id: sessionId, schoolId: context.schoolId } },
    select: { schoolId: true, classPeriodId: true, status: true },
  })
  if (!session) return 'notFound' as const
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  return { actor }
}

function revalidateAttendance() {
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/attendance')
}

async function openAttendance(
  classPeriodId: string,
  occurredOn: Date,
  classScheduleSlotId: string | null
) {
  const actor = await canOperateClass(classPeriodId)
  if (!actor) return 'notFound' as const
  if (!(await enabled(actor.schoolId))) return 'attendanceDisabled' as const
  const frequency = await getAttendanceFrequency(actor.schoolId)
  if (classScheduleSlotId || frequency === 'DAILY') {
    const closures = await db.event.findMany({
      where: {
        schoolId: actor.schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: { lt: new Date(occurredOn.getTime() + DAY_MS) },
        OR: [{ endAt: null }, { endAt: { gte: occurredOn } }],
      },
      select: { status: true, category: true, startAt: true, endAt: true },
    })
    if (isAttendanceClosed(closures, occurredOn)) return 'attendanceClosed' as const
  }
  if (classScheduleSlotId) {
    const slot = await db.classScheduleSlot.findFirst({
      where: {
        id: classScheduleSlotId,
        schoolId: actor.schoolId,
        classPeriodId,
        weekday: planningWeekday(occurredOn),
      },
      select: { id: true },
    })
    if (!slot) return 'notFound' as const
  }
  const occurrenceKey = attendanceOccurrenceKey(frequency, classScheduleSlotId)
  const sessionWhere = {
    schoolId_classPeriodId_occurredOn_occurrenceKey: {
      schoolId: actor.schoolId,
      classPeriodId,
      occurredOn,
      occurrenceKey,
    },
  }
  const loadExisting = () =>
    db.attendanceSession.findUnique({ where: sessionWhere, include: SESSION_WITH_ENTRIES })
  const findOrCreateSession = async () => {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.attendanceSession.findUnique({
          where: sessionWhere,
          include: SESSION_WITH_ENTRIES,
        })
        if (existing) return existing
        const roster = await findRoster(tx, actor.schoolId, classPeriodId, occurredOn)
        return tx.attendanceSession.create({
          data: {
            schoolId: actor.schoolId,
            classPeriodId,
            classScheduleSlotId: frequency === 'DAILY' ? null : classScheduleSlotId,
            occurrenceKey,
            occurredOn,
            createdById: actor.userId,
            updatedById: actor.userId,
            entries: {
              create: missingRosterStudents(
                roster.map((row) => rosterEntry(row)),
                []
              ).map((entry) => ({
                ...entry,
                updatedById: actor.userId,
              })),
            },
          },
          include: SESSION_WITH_ENTRIES,
        })
      })
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error
      const existing = await loadExisting()
      if (!existing) throw error
      return existing
    }
  }
  const session = await findOrCreateSession()
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  revalidatePath('/dashboard/my-classes')
  return session
}

/** Starts the exact planned occurrence selected in the schedule. */
export async function startScheduledAttendanceAction(input: unknown) {
  const parsed = openSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { classPeriodId, occurredOn, classScheduleSlotId } = parsed.data
  return openAttendance(classPeriodId, occurredOn, classScheduleSlotId)
}

/** Starts an exceptional attendance occurrence, deliberately separate from a schedule slot. */
export async function startAdhocAttendanceAction(input: unknown) {
  const parsed = openAdhocSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  return openAttendance(parsed.data.classPeriodId, parsed.data.occurredOn, null)
}

export async function updateAttendanceEntryAction(input: unknown) {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const resolved = await resolveOperableSession(parsed.data.sessionId)
  if (typeof resolved === 'string') return resolved
  const { actor } = resolved
  const reason = await resolveAbsenceReason(
    actor.schoolId,
    parsed.data.status,
    parsed.data.absenceReasonId
  )
  if (reason === 'absenceReasonNotFound') return reason
  const data = {
    status: parsed.data.status,
    ...reason,
    updatedById: actor.userId,
    ...(parsed.data.status === 'LATE'
      ? parsed.data.lateMinutes === undefined
        ? {}
        : { lateMinutes: parsed.data.lateMinutes }
      : { lateMinutes: null }),
    ...(parsed.data.message === undefined ? {} : { message: parsed.data.message }),
  }
  const updated = await db.attendanceEntry.updateMany({
    where: {
      id: parsed.data.entryId,
      attendanceSessionId: parsed.data.sessionId,
      schoolId: actor.schoolId,
    },
    data,
  })
  if (updated.count !== 1) return 'notFound' as const
  revalidateAttendance()
  return 'OK' as const
}

async function resolveAbsenceReason(
  schoolId: string,
  status: z.infer<typeof updateSchema>['status'],
  absenceReasonId: string | null | undefined
) {
  if (status !== 'ABSENT') return { absenceReasonId: null, absenceReasonLabel: null }
  if (absenceReasonId === undefined) return {}
  if (absenceReasonId === null) return { absenceReasonId: null, absenceReasonLabel: null }
  const reason = await absenceReasonGateway.findActive(schoolId, absenceReasonId)
  if (!reason) return 'absenceReasonNotFound' as const
  return { absenceReasonId: reason.id, absenceReasonLabel: reason.label }
}

export async function markAllPresentAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const resolved = await resolveOperableSession(parsed.data.sessionId)
  if (typeof resolved === 'string') return resolved
  const { actor } = resolved
  await db.attendanceEntry.updateMany({
    where: {
      attendanceSessionId: parsed.data.sessionId,
      schoolId: actor.schoolId,
      status: 'NOT_RECORDED',
    },
    data: { status: 'PRESENT', updatedById: actor.userId },
  })
  revalidateAttendance()
  return 'OK' as const
}

export async function validateAttendanceAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const resolved = await resolveOperableSession(parsed.data.sessionId)
  if (typeof resolved === 'string') return resolved
  const { actor } = resolved
  const { absenceReasonRequired } = await getAttendanceEntrySettings(actor.schoolId)
  if (absenceReasonRequired) {
    const missing = await db.attendanceEntry.count({
      where: {
        attendanceSessionId: parsed.data.sessionId,
        schoolId: actor.schoolId,
        status: 'ABSENT',
        absenceReasonId: null,
      },
    })
    if (missing > 0) return 'absenceReasonMissing' as const
  }
  // Conditional write: a session cancelled after `resolveOperableSession` read it is refused rather
  // than silently revived. A VALIDATED session stays re-validatable after a correction.
  const updated = await db.attendanceSession.updateMany({
    where: {
      id: parsed.data.sessionId,
      schoolId: actor.schoolId,
      status: { in: ['DRAFT', 'VALIDATED'] },
    },
    data: { status: 'VALIDATED', validatedAt: new Date(), updatedById: actor.userId },
  })
  if (updated.count !== 1) return 'invalidTransition' as const
  await syncMealAbsencesFromAttendance({
    schoolId: actor.schoolId,
    sessionId: parsed.data.sessionId,
    recordedById: actor.userId,
  })
  revalidateAttendance()
  return 'OK' as const
}

/**
 * Adds to a DRAFT session the students assigned to its class since it was opened. Existing entries,
 * including those of students assigned elsewhere since, are preserved.
 */
export async function refreshAttendanceRosterAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const resolved = await resolveOperableSession(parsed.data.sessionId)
  if (typeof resolved === 'string') return resolved
  const { actor } = resolved
  const { sessionId } = parsed.data
  const refreshed = await db.$transaction(async (tx) => {
    const result = await refreshSessionRoster(tx, {
      schoolId: actor.schoolId,
      sessionId,
      actorId: actor.userId,
      status: 'PRESENT',
    })
    if (typeof result === 'string') return result
    return tx.attendanceSession.findUnique({
      where: { id_schoolId: { id: sessionId, schoolId: actor.schoolId } },
      include: SESSION_WITH_ENTRIES,
    })
  })
  if (!refreshed) return 'notFound' as const
  if (typeof refreshed === 'string') return refreshed
  revalidateAttendance()
  return refreshed
}

export async function setAttendanceCancellationAction(input: {
  sessionId: string
  cancelled: boolean
}) {
  const parsed = cancellationSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const admin = await requireSchoolAdmin()
  if (!(await enabled(admin.schoolId))) return 'attendanceDisabled' as const
  const { sessionId } = parsed.data
  const session = await db.attendanceSession.findFirst({
    where: { id: sessionId, schoolId: admin.schoolId },
    select: { status: true, statusBeforeCancellation: true, _count: { select: { entries: true } } },
  })
  if (!session) return 'notFound' as const
  const transition = planCancellationTransition(
    {
      status: session.status,
      statusBeforeCancellation: session.statusBeforeCancellation,
      entryCount: session._count.entries,
    },
    parsed.data.cancelled
  )
  if (transition.kind === 'invalidTransition') return 'invalidTransition' as const
  if (transition.kind === 'unchanged') return 'OK' as const
  // Every write is conditional on the status read above: a stale tab or a double click that races
  // another change affects no row and is reported instead of silently overwriting the session.
  const result =
    transition.kind === 'deletePlaceholder'
      ? await db.attendanceSession.deleteMany({
          where: {
            id: sessionId,
            schoolId: admin.schoolId,
            status: 'CANCELLED',
            statusBeforeCancellation: null,
            entries: { none: {} },
          },
        })
      : transition.kind === 'cancel'
        ? await db.attendanceSession.updateMany({
            where: { id: sessionId, schoolId: admin.schoolId, status: transition.from },
            data: {
              status: 'CANCELLED',
              statusBeforeCancellation: transition.from,
              updatedById: admin.userId,
            },
          })
        : await db.attendanceSession.updateMany({
            where: {
              id: sessionId,
              schoolId: admin.schoolId,
              status: 'CANCELLED',
              statusBeforeCancellation: session.statusBeforeCancellation,
            },
            data: {
              status: transition.to,
              statusBeforeCancellation: null,
              ...(transition.to === 'DRAFT' ? { validatedAt: null } : {}),
              updatedById: admin.userId,
            },
          })
  if (result.count !== 1) return 'invalidTransition' as const
  await syncMealAbsencesFromAttendance({
    schoolId: admin.schoolId,
    sessionId,
    recordedById: admin.userId,
  })
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}

export async function cancelAttendanceOccurrenceAction(input: unknown) {
  const parsed = openSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const admin = await requireSchoolAdmin()
  if (!(await enabled(admin.schoolId))) return 'attendanceDisabled' as const
  const { occurredOn } = parsed.data
  const slot = await db.classScheduleSlot.findFirst({
    where: {
      id: parsed.data.classScheduleSlotId,
      schoolId: admin.schoolId,
      classPeriodId: parsed.data.classPeriodId,
      weekday: planningWeekday(occurredOn),
    },
    select: { id: true },
  })
  if (!slot) return 'notFound' as const
  const frequency = await getAttendanceFrequency(admin.schoolId)
  const occurrenceKey = attendanceOccurrenceKey(frequency, slot.id)
  const occurrenceWhere = {
    schoolId_classPeriodId_occurredOn_occurrenceKey: {
      schoolId: admin.schoolId,
      classPeriodId: parsed.data.classPeriodId,
      occurredOn,
      occurrenceKey,
    },
  }
  const cancelExisting = async (existing: {
    id: string
    status: 'DRAFT' | 'VALIDATED' | 'CANCELLED'
  }) => {
    if (existing.status === 'CANCELLED') return 'OK' as const
    const updated = await db.attendanceSession.updateMany({
      where: { id: existing.id, schoolId: admin.schoolId, status: existing.status },
      data: {
        status: 'CANCELLED',
        statusBeforeCancellation: existing.status,
        updatedById: admin.userId,
      },
    })
    if (updated.count !== 1) return 'invalidTransition' as const
    await syncMealAbsencesFromAttendance({
      schoolId: admin.schoolId,
      sessionId: existing.id,
      recordedById: admin.userId,
    })
    return 'OK' as const
  }
  const loadExisting = () =>
    db.attendanceSession.findUnique({ where: occurrenceWhere, select: { id: true, status: true } })
  const existing = await loadExisting()
  let result: 'OK' | 'invalidTransition' = 'OK'
  if (existing) {
    result = await cancelExisting(existing)
  } else {
    try {
      await db.attendanceSession.create({
        data: {
          schoolId: admin.schoolId,
          classPeriodId: parsed.data.classPeriodId,
          classScheduleSlotId: frequency === 'DAILY' ? null : slot.id,
          occurrenceKey,
          occurredOn,
          status: 'CANCELLED',
          createdById: admin.userId,
          updatedById: admin.userId,
        },
      })
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error
      // A concurrent opening won the race: cancel what it created rather than reporting success.
      const concurrent = await loadExisting()
      result = concurrent ? await cancelExisting(concurrent) : 'invalidTransition'
    }
  }
  if (result !== 'OK') return result
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}
