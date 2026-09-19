import { DAY_MS, utcStartOfDay } from './day'

export function isAttendanceClosed(
  events: Array<{ status: string; category: string; startAt: Date; endAt?: Date | null }>,
  day: Date
) {
  const start = utcStartOfDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  return events.some(
    (event) =>
      event.status === 'PUBLISHED' &&
      event.category === 'CLOSURE' &&
      event.startAt < end &&
      (!event.endAt || event.endAt >= start)
  )
}
