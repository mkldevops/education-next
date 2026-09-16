'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireSchoolSession, requireTeacher } from './auth-helper'

const openSchema = z.object({
  classPeriodId: z.uuid(),
  classScheduleSlotId: z.uuid().optional(),
  occurredOn: z.coerce.date(),
})
const updateSchema = z.object({
  sessionId: z.uuid(),
  entryId: z.uuid(),
  status: z.enum(['NOT_RECORDED', 'PRESENT', 'ABSENT']),
})
const sessionSchema = z.object({ sessionId: z.uuid() })

async function canOperateClass(classPeriodId: string) {
  const context = await requireSchoolSession()
  if (context.isSuperAdmin || context.role === 'ADMIN')
    return { schoolId: context.schoolId, userId: context.userId }
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

export async function openAttendanceAction(input: unknown) {
  const parsed = openSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const actor = await canOperateClass(parsed.data.classPeriodId)
  if (!actor) return 'notFound' as const
  if (!(await enabled(actor.schoolId))) return 'attendanceDisabled' as const
  if (parsed.data.classScheduleSlotId) {
    const slot = await db.classScheduleSlot.findFirst({
      where: {
        id: parsed.data.classScheduleSlotId,
        schoolId: actor.schoolId,
        classPeriodId: parsed.data.classPeriodId,
      },
      select: { id: true },
    })
    if (!slot) return 'notFound' as const
  }
  const occurredOn = new Date(
    Date.UTC(
      parsed.data.occurredOn.getUTCFullYear(),
      parsed.data.occurredOn.getUTCMonth(),
      parsed.data.occurredOn.getUTCDate()
    )
  )
  const occurrenceKey = parsed.data.classScheduleSlotId ?? 'adhoc'
  const session = await db.$transaction(async (tx) => {
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
    return tx.attendanceSession.upsert({
      where: {
        schoolId_classPeriodId_occurredOn_occurrenceKey: {
          schoolId: actor.schoolId,
          classPeriodId: parsed.data.classPeriodId,
          occurredOn,
          occurrenceKey,
        },
      },
      update: {},
      create: {
        schoolId: actor.schoolId,
        classPeriodId: parsed.data.classPeriodId,
        classScheduleSlotId: parsed.data.classScheduleSlotId,
        occurrenceKey,
        occurredOn,
        createdById: actor.userId,
        updatedById: actor.userId,
        entries: {
          create: roster.map(({ enrollment }) => ({
            schoolId: actor.schoolId,
            studentId: enrollment.studentId,
            studentName: `${enrollment.student.person.lastname} ${enrollment.student.person.name}`,
            updatedById: actor.userId,
          })),
        },
      },
      include: { entries: { orderBy: { studentName: 'asc' } } },
    })
  })
  revalidatePath('/dashboard/my-classes')
  return session
}

export async function updateAttendanceEntryAction(input: unknown) {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const session = await db.attendanceSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { schoolId: true, classPeriodId: true },
  })
  if (!session) return 'notFound' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  const updated = await db.attendanceEntry.updateMany({
    where: {
      id: parsed.data.entryId,
      attendanceSessionId: parsed.data.sessionId,
      schoolId: actor.schoolId,
    },
    data: { status: parsed.data.status, updatedById: actor.userId },
  })
  if (updated.count !== 1) return 'notFound' as const
  return 'OK' as const
}

export async function markAllPresentAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const session = await db.attendanceSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { schoolId: true, classPeriodId: true },
  })
  if (!session) return 'notFound' as const
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
  return 'OK' as const
}

export async function validateAttendanceAction(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const session = await db.attendanceSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { schoolId: true, classPeriodId: true },
  })
  if (!session) return 'notFound' as const
  const actor = await canOperateClass(session.classPeriodId)
  if (!actor || actor.schoolId !== session.schoolId || !(await enabled(actor.schoolId)))
    return 'notFound' as const
  const updated = await db.attendanceSession.updateMany({
    where: { id: parsed.data.sessionId, schoolId: actor.schoolId },
    data: { status: 'VALIDATED', validatedAt: new Date(), updatedById: actor.userId },
  })
  if (updated.count !== 1) return 'notFound' as const
  return 'OK' as const
}
