import { roundHalfUp } from '@/lib/decimal'

/** What happens to the part still unpaid at departure. */
export const DEPARTURE_REMAINDERS = ['keep', 'writeOff'] as const
export type DepartureRemainder = (typeof DEPARTURE_REMAINDERS)[number]

const monthOf = (date: Date) => date.toISOString().slice(0, 7)

function nextMonth(month: string) {
  const [year, index] = month.split('-').map(Number)
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`
}

/**
 * Months a student can leave after: from the first month of its open enrollments' periods to
 * the last one. Without any period, only the current month.
 */
export function departureMonths(
  periods: ReadonlyArray<{ startAt: Date; endAt: Date }>,
  currentMonth: string
): string[] {
  if (periods.length === 0) return [currentMonth]
  const first = periods.map((period) => monthOf(period.startAt)).sort()[0]
  const last = periods
    .map((period) => monthOf(period.endAt))
    .sort()
    .at(-1) as string
  const months: string[] = []
  for (let month = first; month <= last; month = nextMonth(month)) months.push(month)
  return months
}

/** The current school month, brought back inside the selectable months. */
export function defaultDepartureMonth(months: readonly string[], currentMonth: string) {
  if (currentMonth < months[0]) return months[0]
  if (currentMonth > (months.at(-1) as string)) return months.at(-1) as string
  return currentMonth
}

/**
 * New total of an enrollment closed by a departure. `owed` is what it owes through the last
 * month; a payment already beyond it is never turned into a credit. Kept, the remainder stays
 * owed; written off, the total drops to what was paid and the forgiven part is recorded.
 */
export function departureSettlement(owed: number, paid: number, remainder: DepartureRemainder) {
  if (remainder === 'keep') {
    return { totalAmount: roundHalfUp(Math.max(owed, paid)), writeOffAmount: null }
  }
  return {
    totalAmount: roundHalfUp(paid),
    writeOffAmount: Math.max(0, roundHalfUp(owed - paid)),
  }
}
