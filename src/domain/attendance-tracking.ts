import { planningWeekday } from './current-week-dates'

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
  const weekday = planningWeekday(date)
  return slots
    .filter((slot) => slot.weekday === weekday && !excludedSlotIds.has(slot.id))
    .flatMap<ExpectedAttendance>((slot) => {
      const session = sessions.find(
        (candidate) =>
          candidate.classPeriodId === slot.classPeriodId && candidate.occurrenceKey === slot.id
      )
      if (session?.status === 'CANCELLED') return []
      return [
        {
          classPeriodId: slot.classPeriodId,
          classScheduleSlotId: slot.id,
          occurredOn: date,
          status:
            session?.status === 'VALIDATED' ? 'VALIDATED' : session ? 'IN_PROGRESS' : 'NOT_STARTED',
        },
      ]
    })
}
