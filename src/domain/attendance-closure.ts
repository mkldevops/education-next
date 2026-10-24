import { isSchoolClosed } from './school-closure'

const ATTENDANCE_CLOSURE_CATEGORIES = ['CLOSURE'] as const

export function isAttendanceClosed(
  events: Array<{ status: string; category: string; startAt: Date; endAt?: Date | null }>,
  day: Date
) {
  return isSchoolClosed(events, day, ATTENDANCE_CLOSURE_CATEGORIES)
}
