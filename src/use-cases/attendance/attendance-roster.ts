import {
  attendanceRosterWindow,
  canRefreshRoster,
  missingRosterStudents,
} from '@/domain/attendance-session'
import { utcStartOfDay } from '@/domain/day'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type RosterEntryStatus = 'PRESENT' | 'NOT_RECORDED'

/**
 * Active class assignments on the roster of `occurredOn`, including one created during that UTC day.
 * Root query: always scoped by `schoolId`.
 */
export function findRoster(
  tx: Prisma.TransactionClient,
  schoolId: string,
  classPeriodId: string,
  occurredOn: Date
) {
  const { startsBefore, endsFrom } = attendanceRosterWindow(occurredOn)
  return tx.classAssignment.findMany({
    where: {
      schoolId,
      classPeriodId,
      startAt: { lt: startsBefore },
      OR: [{ endAt: null }, { endAt: { gte: endsFrom } }],
      enrollment: { status: 'ACTIVE' },
    },
    include: { enrollment: { include: { student: { include: { person: true } } } } },
  })
}

export function rosterEntry(
  { enrollment }: Awaited<ReturnType<typeof findRoster>>[number],
  status: RosterEntryStatus = 'PRESENT'
) {
  return {
    status,
    studentId: enrollment.studentId,
    studentName: `${enrollment.student.person.lastname} ${enrollment.student.person.name}`,
  }
}

/**
 * Adds to a DRAFT session the students assigned to its class since it was opened. Existing entries,
 * including those of students assigned elsewhere since, are preserved.
 *
 * `status` is `PRESENT` when the person refreshing sees the roster (the call screen), and
 * `NOT_RECORDED` when nobody does (assistant, enrollment): a call validated from a screen loaded
 * before the addition must not record an unseen student as present.
 */
export async function refreshSessionRoster(
  tx: Prisma.TransactionClient,
  input: { schoolId: string; sessionId: string; actorId: string; status: RosterEntryStatus }
) {
  const { schoolId, sessionId, actorId, status } = input
  const session = await tx.attendanceSession.findUnique({
    where: { id_schoolId: { id: sessionId, schoolId } },
    select: { status: true, classPeriodId: true, occurredOn: true },
  })
  if (!session) return 'notFound' as const
  if (!canRefreshRoster(session.status)) return 'invalidTransition' as const
  // Conditional write: row-locks the DRAFT session so a concurrent validation waits for the refresh.
  const locked = await tx.attendanceSession.updateMany({
    where: { id: sessionId, schoolId, status: 'DRAFT' },
    data: { updatedById: actorId },
  })
  if (locked.count !== 1) return 'invalidTransition' as const
  const [roster, existing] = await Promise.all([
    findRoster(tx, schoolId, session.classPeriodId, session.occurredOn),
    tx.attendanceEntry.findMany({
      where: { attendanceSessionId: sessionId, schoolId },
      select: { studentId: true },
    }),
  ])
  const missing = missingRosterStudents(
    roster.map((row) => rosterEntry(row, status)),
    existing.map(({ studentId }) => studentId)
  )
  if (missing.length > 0) {
    await tx.attendanceEntry.createMany({
      data: missing.map((entry) => ({
        ...entry,
        schoolId,
        attendanceSessionId: sessionId,
        updatedById: actorId,
      })),
      skipDuplicates: true,
    })
  }
  return { added: missing.map(({ studentId, studentName }) => ({ studentId, studentName })) }
}

/**
 * After an enrollment write: adds the students now in a class to the calls of that class still in
 * progress from today on. Best effort: a failure is logged and never undoes the enrollment, already
 * committed; the call screen's refresh button remains the fallback.
 */
export async function syncOpenAttendanceRosters(
  input: { schoolId: string; actorId: string; enrollmentIds: readonly string[] },
  now = new Date()
) {
  const { schoolId, actorId, enrollmentIds } = input
  if (enrollmentIds.length === 0) return 0
  try {
    const assignments = await db.classAssignment.findMany({
      where: {
        schoolId,
        endAt: null,
        enrollmentId: { in: [...enrollmentIds] },
        enrollment: { status: 'ACTIVE' },
      },
      select: { classPeriodId: true },
    })
    const classPeriodIds = [...new Set(assignments.map(({ classPeriodId }) => classPeriodId))]
    if (classPeriodIds.length === 0) return 0
    const sessions = await db.attendanceSession.findMany({
      where: {
        schoolId,
        classPeriodId: { in: classPeriodIds },
        status: 'DRAFT',
        occurredOn: { gte: utcStartOfDay(now) },
      },
      select: { id: true },
    })
    let added = 0
    for (const { id } of sessions) {
      const result = await db.$transaction((tx) =>
        refreshSessionRoster(tx, { schoolId, sessionId: id, actorId, status: 'NOT_RECORDED' })
      )
      if (typeof result !== 'string') added += result.added.length
    }
    return added
  } catch (error) {
    console.error('[attendance] syncOpenAttendanceRosters', error)
    return 0
  }
}
