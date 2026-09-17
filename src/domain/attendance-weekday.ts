/** Converts the UTC calendar weekday to the schedule convention (Monday 1 … Sunday 7). */
export function attendanceScheduleWeekday(date: Date) {
  return date.getUTCDay() || 7
}
