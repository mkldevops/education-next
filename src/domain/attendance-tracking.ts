import { type AttendanceFrequency, attendanceOccurrenceKey } from './attendance-frequency'
import { planningWeekday } from './current-week-dates'

export type ExpectedAttendance = {
  classPeriodId: string
  classScheduleSlotId: string
  occurrenceKey: string
  occurredOn: Date
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'VALIDATED'
}

type Slot = { id: string; classPeriodId: string; weekday: number; startTime?: string }
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
  excludedSlotIds: ReadonlySet<string> = new Set(),
  frequency: AttendanceFrequency = 'PER_SLOT'
): ExpectedAttendance[] {
  const weekday = planningWeekday(date)
  const matchingSlots = slots.filter(
    (slot) => slot.weekday === weekday && !excludedSlotIds.has(slot.id)
  )
  const occurrences =
    frequency === 'DAILY'
      ? Array.from(
          matchingSlots
            .reduce((byClass, slot) => {
              const current = byClass.get(slot.classPeriodId)
              if (!current || (slot.startTime ?? '') < (current.startTime ?? '')) {
                byClass.set(slot.classPeriodId, slot)
              }
              return byClass
            }, new Map<string, Slot>())
            .values()
        )
      : matchingSlots
  return occurrences.flatMap<ExpectedAttendance>((slot) => {
    const occurrenceKey = attendanceOccurrenceKey(frequency, slot.id)
    const session = sessions.find(
      (candidate) =>
        candidate.classPeriodId === slot.classPeriodId && candidate.occurrenceKey === occurrenceKey
    )
    if (session?.status === 'CANCELLED') return []
    return [
      {
        classPeriodId: slot.classPeriodId,
        classScheduleSlotId: slot.id,
        occurrenceKey,
        occurredOn: date,
        status:
          session?.status === 'VALIDATED' ? 'VALIDATED' : session ? 'IN_PROGRESS' : 'NOT_STARTED',
      },
    ]
  })
}
