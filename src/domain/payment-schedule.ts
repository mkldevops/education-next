import { z } from 'zod'
import { currencyFractionDigits, roundHalfUp } from '@/lib/decimal'
import { isCurrencyAmount } from './enrollment'

const priceAmount = z.number().positive().max(99_999_999.99).refine(isCurrencyAmount)

export const planPricingSchema = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('ANNUAL'), amount: priceAmount }),
    z.object({
      mode: z.literal('MONTHLY'),
      amount: priceAmount,
      months: z.number().int().min(1).max(12),
    }),
  ])
  .refine(
    (pricing) => pricing.amount * (pricing.mode === 'MONTHLY' ? pricing.months : 1) <= 99_999_999.99
  )

const month = z.number().int().min(1).max(12)
const day = z.number().int().min(1).max(31)

export const paymentScheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('NONE') }),
  z.object({
    mode: z.literal('MONTHLY'),
    firstMonth: month,
    count: z.number().int().min(1).max(12),
    dueDay: day,
  }),
  z.object({
    mode: z.literal('QUARTERLY'),
    firstMonth: month,
    count: z.number().int().min(1).max(4),
    dueDay: day,
  }),
  z.object({
    mode: z.literal('INSTALLMENTS'),
    dates: z
      .array(z.object({ month, day }))
      .min(1)
      .max(5)
      .refine(
        (dates) => new Set(dates.map((date) => `${date.month}-${date.day}`)).size === dates.length
      ),
  }),
])

export type PlanPricing = z.infer<typeof planPricingSchema>
export type PaymentSchedule = z.infer<typeof paymentScheduleSchema>

/** The stored plan amount always remains the total, whichever input basis was chosen. */
export function annualPlanAmount(pricing: PlanPricing): number {
  return roundHalfUp(pricing.amount * (pricing.mode === 'MONTHLY' ? pricing.months : 1))
}

export function readPlanPricing(value: unknown, annualAmount: number): PlanPricing {
  const parsed = planPricingSchema.safeParse(value)
  return parsed.success && annualPlanAmount(parsed.data) === annualAmount
    ? parsed.data
    : { mode: 'ANNUAL', amount: annualAmount }
}

export function readPaymentSchedule(value: unknown): PaymentSchedule {
  const parsed = paymentScheduleSchema.safeParse(value)
  return parsed.success ? parsed.data : { mode: 'NONE' }
}

export type PaymentInstallment = { dueDate: string; amount: number }

function dueDate(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

/**
 * Month/day settings recur in the enrollment's school year, never in the current year.
 * February and other short months use their last day for a deadline of 29–31.
 * Rounding happens in currency minor units; the final installment carries the remainder.
 */
export function paymentInstallments(
  schedule: PaymentSchedule,
  totalAmount: number,
  periodStart: Date,
  currency: string,
  startMonth: string | null = null
): PaymentInstallment[] {
  if (schedule.mode === 'NONE') return []
  const year = periodStart.getUTCFullYear()
  const periodFirstMonth = periodStart.getUTCMonth() + 1
  const yearOf = (month: number) => year + (month < periodFirstMonth ? 1 : 0)
  const dates =
    schedule.mode === 'INSTALLMENTS'
      ? schedule.dates.map((date) => dueDate(yearOf(date.month), date.month - 1, date.day)).sort()
      : Array.from({ length: schedule.count }, (_, index) =>
          dueDate(
            yearOf(schedule.firstMonth),
            schedule.firstMonth - 1 + index * (schedule.mode === 'QUARTERLY' ? 3 : 1),
            schedule.dueDay
          )
        )
  // A late enrollment owes nothing before its start month: its total is split over the
  // remaining deadlines only, so the earlier ones never show as arrears.
  const owedDates = startMonth ? dates.filter((date) => date >= firstDayOf(startMonth)) : dates
  if (owedDates.length === 0) return []
  return splitAmount(owedDates, totalAmount, currency)
}

function splitAmount(dates: string[], totalAmount: number, currency: string) {
  const factor = 10 ** currencyFractionDigits(currency)
  // Preserve fractional legacy amounts rather than inventing debt by rounding up.
  // New plan prices validate the school's currency precision.
  const totalUnits = roundHalfUp(totalAmount * factor)
  const units = Math.floor(totalUnits / dates.length)
  return dates.map((date, index) => ({
    dueDate: date,
    amount: (index === dates.length - 1 ? totalUnits - units * index : units) / factor,
  }))
}

/** `YYYY-MM`: the month an enrollment starts owing installments. */
export const startMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

function firstDayOf(startMonth: string): string {
  return `${startMonth}-01`
}

const monthOf = (date: Date) => date.toISOString().slice(0, 7)

/** Persisted as the first day of the month, at midnight UTC. */
export function startMonthToDate(startMonth: string): Date {
  return new Date(`${firstDayOf(startMonth)}T00:00:00.000Z`)
}

export function startMonthFromDate(date: Date | null | undefined): string | null {
  return date ? monthOf(date) : null
}

export function validateStartMonth(
  startMonth: string,
  period: { startAt: Date; endAt: Date }
): 'OK' | 'startMonthOutsidePeriod' {
  return startMonth >= monthOf(period.startAt) && startMonth <= monthOf(period.endAt)
    ? 'OK'
    : 'startMonthOutsidePeriod'
}

/**
 * The part of a plan an enrollment owes when it starts at `startMonth`: the plan's
 * installments due from that month on. Without a start month, the whole plan amount.
 * A plan without deadlines cannot be prorated, and a start after the last deadline
 * would owe nothing: both are refused rather than guessed.
 */
export function owedPlanAmount(
  planAmount: number,
  schedule: PaymentSchedule,
  periodStart: Date,
  currency: string,
  startMonth: string | null
): number | 'noPaymentSchedule' | 'noInstallmentDue' {
  if (!startMonth) return planAmount
  const all = paymentInstallments(schedule, planAmount, periodStart, currency)
  if (all.length === 0) return 'noPaymentSchedule'
  const owed = all.filter((installment) => installment.dueDate >= firstDayOf(startMonth))
  if (owed.length === 0) return 'noInstallmentDue'
  return roundHalfUp(owed.reduce((sum, installment) => sum + installment.amount, 0))
}

export function paymentTracking(
  installments: PaymentInstallment[],
  paidToDate: number,
  today: string
) {
  const expectedToDate = roundHalfUp(
    installments
      .filter((installment) => installment.dueDate < today)
      .reduce((sum, installment) => sum + installment.amount, 0)
  )
  return {
    expectedToDate,
    overdueAmount: Math.max(0, roundHalfUp(expectedToDate - paidToDate)),
    tracked: installments.length > 0,
  }
}
