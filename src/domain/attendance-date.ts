const DATE = /^\d{4}-\d{2}-\d{2}$/
export function attendanceUtcDate(value: string | undefined, fallback = new Date()) {
  if (!value || !DATE.test(value)) return fallback
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? fallback : date
}
