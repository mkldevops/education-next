/** Returns the UTC calendar date for each ISO weekday (Monday = 1) in the reference week. */
export function currentWeekDates(reference: Date): Record<number, string> {
  const isoWeekday = reference.getUTCDay() || 7
  const monday = new Date(reference)
  monday.setUTCDate(reference.getUTCDate() - isoWeekday + 1)

  return Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setUTCDate(monday.getUTCDate() + index)
      return [index + 1, date.toISOString().slice(0, 10)]
    })
  )
}
