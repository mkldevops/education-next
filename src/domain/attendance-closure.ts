export function isAttendanceClosed(
  events: Array<{ status: string; category: string; startAt: Date; endAt?: Date | null }>,
  day: Date
) {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const end = new Date(start.getTime() + 86400000)
  return events.some(
    (event) =>
      event.status === 'PUBLISHED' &&
      event.category === 'CLOSURE' &&
      event.startAt <= end &&
      (!event.endAt || event.endAt >= start)
  )
}
