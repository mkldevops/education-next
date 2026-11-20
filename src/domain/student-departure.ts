import type { EnrollmentStatus } from '@/generated/prisma/client'
import { roundHalfUp } from '@/lib/decimal'
import { OPEN_ENROLLMENT_STATUSES } from './enrollment'
import { owedThroughMonth, type PaymentSchedule } from './payment-schedule'
import { schoolToday } from './school-date'

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

/**
 * Last month owed by an enrollment that an archive older than `archiveStudent` left open. Such an
 * archive only set `isActive: false` and `leftAt`: the enrollment kept its status, without
 * `endMonth` nor a total cut to the departure, and would still owe the whole year. Read as of the
 * school month of `leftAt`, it owes what `archiveStudent` would have kept. `null` for any other
 * enrollment, including one whose archive `leftAt` does not date.
 */
export function legacyDepartureMonth(
  student: { isActive: boolean; leftAt: Date | null },
  enrollment: { status: EnrollmentStatus; endMonth: Date | null },
  timeZone: string
): string | null {
  if (student.isActive || !student.leftAt || enrollment.endMonth) return null
  if (!(OPEN_ENROLLMENT_STATUSES as readonly EnrollmentStatus[]).includes(enrollment.status)) {
    return null
  }
  return schoolToday(timeZone, student.leftAt).slice(0, 7)
}

/**
 * Total an enrollment left open by a legacy archive owes as of its departure month: the deadlines
 * due through that month, or what was already paid when more (`departureSettlement`, `keep`), as
 * `archiveStudent` would have cut it. Without a schedule or a period, the whole total stays owed.
 */
export function legacyDepartureTotal(
  enrollment: {
    schedule: PaymentSchedule
    totalAmount: number
    periodStart: Date | null
    startMonth: string | null
    firstInstallmentAmount: number | null
  },
  departureMonth: string,
  paid: number,
  currency: string
): number {
  const owed = owedThroughMonth(
    enrollment.schedule,
    enrollment.totalAmount,
    enrollment.periodStart,
    currency,
    {
      startMonth: enrollment.startMonth,
      endMonth: departureMonth,
      firstInstallmentAmount: enrollment.firstInstallmentAmount,
    }
  ).amount
  return departureSettlement(owed, paid, 'keep').totalAmount
}
