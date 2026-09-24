import { DAY_MS, utcStartOfDay } from './day'

type AttendanceSessionStatus = 'DRAFT' | 'VALIDATED' | 'CANCELLED'
type ActiveStatus = Exclude<AttendanceSessionStatus, 'CANCELLED'>

/**
 * Bounds of the class assignments that belong on the roster of a UTC calendar day (the V1 school-time
 * convention). `ClassAssignment.startAt` is a creation timestamp, so an assignment made during the
 * day must be compared with the end of that day, not with its midnight.
 */
export function attendanceRosterWindow(occurredOn: Date) {
  const dayStart = utcStartOfDay(occurredOn)
  return { startsBefore: new Date(dayStart.getTime() + DAY_MS), endsFrom: dayStart }
}

/** Roster rows whose student has no entry yet in the session, without duplicates. */
export function missingRosterStudents<T extends { studentId: string }>(
  roster: readonly T[],
  existingStudentIds: Iterable<string>
): T[] {
  const seen = new Set(existingStudentIds)
  return roster.filter(({ studentId }) => {
    if (seen.has(studentId)) return false
    seen.add(studentId)
    return true
  })
}

/** Only a session still being taken may receive students assigned after it was opened. */
export function canRefreshRoster(status: AttendanceSessionStatus) {
  return status === 'DRAFT'
}

export type CancellationTransition =
  | { kind: 'unchanged' }
  | { kind: 'invalidTransition' }
  | { kind: 'cancel'; from: ActiveStatus }
  | { kind: 'deletePlaceholder' }
  | { kind: 'restore'; to: ActiveStatus }

/**
 * Plans a cancel/restore request against the status read by the caller. The caller must apply it
 * conditionally on that same status so that a concurrent change is refused instead of overwritten.
 */
export function planCancellationTransition(
  session: {
    status: AttendanceSessionStatus
    statusBeforeCancellation: ActiveStatus | 'CANCELLED' | null
    entryCount: number
  },
  cancelled: boolean
): CancellationTransition {
  if (cancelled) {
    return session.status === 'CANCELLED'
      ? { kind: 'unchanged' }
      : { kind: 'cancel', from: session.status }
  }
  if (session.status !== 'CANCELLED') return { kind: 'invalidTransition' }
  const previous =
    session.statusBeforeCancellation === 'CANCELLED' ? null : session.statusBeforeCancellation
  if (session.entryCount === 0 && !previous) return { kind: 'deletePlaceholder' }
  return { kind: 'restore', to: previous ?? 'DRAFT' }
}
