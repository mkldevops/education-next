export type WeeklyTimeRange = {
  weekday: number
  startTime: string
  endTime: string
}

function isValidScheduleTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** A schedule slot is a half-open interval: 09:00–10:00 and 10:00–11:00 do not overlap. */
export function validateWeeklyTimeRange(range: WeeklyTimeRange): 'OK' | 'invalidTimeRange' {
  if (!Number.isInteger(range.weekday) || range.weekday < 1 || range.weekday > 7) {
    return 'invalidTimeRange'
  }
  if (!isValidScheduleTime(range.startTime) || !isValidScheduleTime(range.endTime)) {
    return 'invalidTimeRange'
  }
  return range.endTime > range.startTime ? 'OK' : 'invalidTimeRange'
}

export function weeklyTimeRangesOverlap(left: WeeklyTimeRange, right: WeeklyTimeRange): boolean {
  return (
    left.weekday === right.weekday &&
    left.startTime < right.endTime &&
    left.endTime > right.startTime
  )
}
