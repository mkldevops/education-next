'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { attendanceScheduleWeekday } from '@/domain/attendance-weekday'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireSchoolAdmin, requireSchoolSession, requireTeacher } from './auth-helper'

const openSchema = z.object({
  classPeriodId: z.uuid(),
  classScheduleSlotId: z.uuid(),
  occurredOn: z.coerce.date(),
})
const openAdhocSchema = z.object({
  classPeriodId: z.uuid(),
  occurredOn: z.coerce.date(),
})
const updateSchema = z.object({
  sessionId: z.uuid(),
  entryId: z.uuid(),
  status: z.enum(['NOT_RECORDED', 'PRESENT', 'ABSENT', 'LATE']),
  // Omitted fields preserve existing values for callers using the pre-R2 payload.
  lateMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
})
const sessionSchema = z.object({ sessionId: z.uuid() })
const cancellationSchema = z.object({ sessionId: z.uuid(), cancelled: z.boolean() })
const cancelOccurrenceSchema = z.object({
  classPeriodId: z.uuid(),
  classScheduleSlotId: z.uuid(),
  occurredOn: z.coerce.date(),
})

async function canOperateClass(classPeriodId: string) {
  const context = await requireSchoolSession()
  if (context.isSuperAdmin || context.role === 'ADMIN') {
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

async function openAttendance(input: unknown, occurrence: 'scheduled' | 'adhoc') {
  const parsed = (occurrence === 'scheduled' ? openSchema : openAdhocSchema).safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const actor = await canOperateClass(parsed.data.classPeriodId)
  if (!actor) return 'notFound' as const
  if (!(await enabled(actor.schoolId))) return 'attendanceDisabled' as const
  const occurredOn = new Date(
    Date.UTC(
      parsed.data.occurredOn.getUTCFullYear(),
      parsed.data.occurredOn.getUTCMonth(),
      parsed.data.occurredOn.getUTCDate()
    )
  )
  const classScheduleSlotId =
    occurrence === 'scheduled'
      ? (parsed.data as unknown as z.infer<typeof openSchema>).classScheduleSlotId
      : null
  if (occurrence === 'scheduled') {
    if (!classScheduleSlotId) return 'validationError' as const
    const closures = await db.event.findMany({
      where: {
        schoolId: actor.schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: { lt: new Date(occurredOn.getTime() + 86400000) },
        OR: [{ endAt: null }, { endAt: { gte: occurredOn } }],
      },
      select: { status: true, category: true, startAt: true, endAt: true },
    })
    if (isAttendanceClosed(closures, occurredOn)) return 'attendanceClosed' as const
  }
  if (occurrence === 'scheduled') {
    const slot = await db.classScheduleSlot.findFirst({
      where: {
        id: classScheduleSlotId ?? '',
        schoolId: actor.schoolId,
        classPeriodId: parsed.data.classPeriodId,
        weekday: attendanceScheduleWeekday(occurredOn),
      },
      select: { id: true },
    })
    if (!slot) return 'notFound' as const
  }
  const occurrenceKey = classScheduleSlotId ?? 'adhoc'
  const sessionWhere = {
    schoolId_classPeriodId_occurredOn_occurrenceKey: {
      schoolId: actor.schoolId,
      classPeriodId: parsed.data.classPeriodId,
      occurredOn,
      occurrenceKey,
    },
  }
  const loadExisting = () =>
    db.attendanceSession.findUnique({
      where: sessionWhere,
      include: { entries: { orderBy: { studentName: 'asc' } } },
    })
  const session = await (async () => {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.attendanceSession.findUnique({
          where: sessionWhere,
          include: { entries: { orderBy: { studentName: 'asc' } } },
        })
        if (existing) return existing
        const roster = await tx.classAssignment.findMany({
          where: {
            schoolId: actor.schoolId,
            classPeriodId: parsed.data.classPeriodId,
            startAt: { lte: occurredOn },
            OR: [{ endAt: null }, { endAt: { gte: occurredOn } }],
            enrollment: { status: 'ACTIVE' },
          },
          include: { enrollment: { include: { student: { include: { person: true } } } } },
        })
        return tx.attendanceSession.create({
          data: {
            schoolId: actor.schoolId,
            classPeriodId: parsed.data.classPeriodId,
            classScheduleSlotId,
            occurrenceKey,
            occurredOn,
            createdById: actor.userId,
            updatedById: actor.userId,
            entries: {
              create: roster.map(({ enrollment }) => ({
                studentId: enrollment.studentId,
                studentName: `${enrollment.student.person.lastname} ${enrollment.student.person.name}`,
                updatedById: actor.userId,
              })),
            },
          },
          include: { entries: { orderBy: { studentName: 'asc' } } },
        })
      })
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error
      const existing = await loadExisting()
      if (!existing) throw error
      return existing
    }
  })()
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  revalidatePath('/dashboard/my-classes')
  return session
}

/** Starts the exact planned occurrence selected in the schedule. */
export async function startScheduledAttendanceAction(input: unknown) {
  return openAttendance(input, 'scheduled')
}

/** Starts an exceptional attendance occurrence, deliberately separate from a schedule slot. */
export async function startAdhocAttendanceAction(input: unknown) {
  return openAttendance(input, 'adhoc')
}

export async function updateAttendanceEntryAction(input: unknown) {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const context = await requireSchoolSession()
  const session = await db.attendanceSession.findUnique({
    where: { id_schoolId: { id: parsed.data.sessionId, schoolId: context.schoolId } },
    select: { schoolId: true, classPeriodId: true, status: true },
  })
  if (!session) return 'notFound' as const
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  const data = {
    status: parsed.data.status,
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
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}

export async function markAllPresentAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const context = await requireSchoolSession()
  const session = await db.attendanceSession.findUnique({
    where: { id_schoolId: { id: parsed.data.sessionId, schoolId: context.schoolId } },
    select: { schoolId: true, classPeriodId: true, status: true },
  })
  if (!session) return 'notFound' as const
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  await db.attendanceEntry.updateMany({
    where: {
      attendanceSessionId: parsed.data.sessionId,
      schoolId: actor.schoolId,
      status: 'NOT_RECORDED',
    },
    data: { status: 'PRESENT', updatedById: actor.userId },
  })
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}

export async function validateAttendanceAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const context = await requireSchoolSession()
  const session = await db.attendanceSession.findUnique({
    where: { id_schoolId: { id: parsed.data.sessionId, schoolId: context.schoolId } },
    select: { schoolId: true, classPeriodId: true, status: true },
  })
  if (!session) return 'notFound' as const
  if (session.status === 'CANCELLED') return 'sessionCancelled' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  const updated = await db.attendanceSession.updateMany({
    where: { id: parsed.data.sessionId, schoolId: actor.schoolId },
    data: { status: 'VALIDATED', validatedAt: new Date(), updatedById: actor.userId },
  })
  if (updated.count !== 1) return 'notFound' as const
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}

export async function setAttendanceCancellationAction(input: {
  sessionId: string
  cancelled: boolean
}) {
  const parsed = cancellationSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const admin = await requireSchoolAdmin()
  const session = await db.attendanceSession.findFirst({
    where: { id: parsed.data.sessionId, schoolId: admin.schoolId },
    select: { status: true, statusBeforeCancellation: true, _count: { select: { entries: true } } },
  })
  if (!session) return 'notFound' as const
  if (
    !parsed.data.cancelled &&
    session.status === 'CANCELLED' &&
    session._count.entries === 0 &&
    !session.statusBeforeCancellation
  ) {
    await db.attendanceSession.deleteMany({
      where: { id: parsed.data.sessionId, schoolId: admin.schoolId },
    })
    revalidatePath('/dashboard/attendance')
    return 'OK' as const
  }
  const result = await db.attendanceSession.updateMany({
    where: { id: parsed.data.sessionId, schoolId: admin.schoolId },
    data: parsed.data.cancelled
      ? {
          status: 'CANCELLED',
          statusBeforeCancellation:
            session.status === 'CANCELLED' ? session.statusBeforeCancellation : session.status,
          updatedById: admin.userId,
        }
      : {
          status: session.statusBeforeCancellation ?? 'DRAFT',
          statusBeforeCancellation: null,
          updatedById: admin.userId,
        },
  })
  if (result.count !== 1) return 'notFound' as const
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}

export async function cancelAttendanceOccurrenceAction(input: unknown) {
  const parsed = cancelOccurrenceSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const admin = await requireSchoolAdmin()
  const slot = await db.classScheduleSlot.findFirst({
    where: {
      id: parsed.data.classScheduleSlotId,
      schoolId: admin.schoolId,
      classPeriodId: parsed.data.classPeriodId,
    },
    select: { id: true },
  })
  if (!slot) return 'notFound' as const
  const occurredOn = new Date(
    Date.UTC(
      parsed.data.occurredOn.getUTCFullYear(),
      parsed.data.occurredOn.getUTCMonth(),
      parsed.data.occurredOn.getUTCDate()
    )
  )
  const occurrenceWhere = {
    schoolId_classPeriodId_occurredOn_occurrenceKey: {
      schoolId: admin.schoolId,
      classPeriodId: parsed.data.classPeriodId,
      occurredOn,
      occurrenceKey: slot.id,
    },
  }
  const existing = await db.attendanceSession.findUnique({
    where: occurrenceWhere,
    select: { id: true, status: true },
  })
  if (existing?.status === 'CANCELLED') return 'OK' as const
  if (existing) {
    await db.attendanceSession.updateMany({
      where: { id: existing.id, schoolId: admin.schoolId },
      data: {
        status: 'CANCELLED',
        statusBeforeCancellation: existing.status,
        updatedById: admin.userId,
      },
    })
  } else {
    try {
      await db.attendanceSession.create({
        data: {
          schoolId: admin.schoolId,
          classPeriodId: parsed.data.classPeriodId,
          classScheduleSlotId: slot.id,
          occurrenceKey: slot.id,
          occurredOn,
          status: 'CANCELLED',
          createdById: admin.userId,
          updatedById: admin.userId,
        },
      })
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error
    }
  }
  revalidatePath('/dashboard/attendance')
  return 'OK' as const
}
