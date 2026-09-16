export type ExpectedAttendance = {
  classPeriodId: string
  classScheduleSlotId: string
  occurredOn: Date
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'VALIDATED'
}

type Slot = { id: string; classPeriodId: string; weekday: number }
type Session = {
  classPeriodId: string
  occurrenceKey: string
  status: 'DRAFT' | 'VALIDATED' | 'CANCELLED'
}

/** School convention: occurrences use the calendar date selected by the school (UTC date at V1). */
export function expectedAttendance(
  date: Date,
  slots: Slot[],
  sessions: Session[],
  excludedSlotIds: ReadonlySet<string> = new Set()
): ExpectedAttendance[] {
  return slots
    .filter(
      (slot) =>
        slot.weekday === date.getUTCDay() &&
        !excludedSlotIds.has(slot.id) &&
        sessions.find(
          (session) =>
            session.classPeriodId === slot.classPeriodId && session.occurrenceKey === slot.id
        )?.status !== 'CANCELLED'
    )
    .map((slot) => {
      const session = sessions.find(
        (candidate) =>
          candidate.classPeriodId === slot.classPeriodId && candidate.occurrenceKey === slot.id
      )
      return {
        classPeriodId: slot.classPeriodId,
        classScheduleSlotId: slot.id,
        occurredOn: date,
        status:
          session?.status === 'VALIDATED' ? 'VALIDATED' : session ? 'IN_PROGRESS' : 'NOT_STARTED',
      }
    })
}
