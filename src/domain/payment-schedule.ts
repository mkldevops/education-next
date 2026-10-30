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
  currency: string
): PaymentInstallment[] {
  if (schedule.mode === 'NONE') return []
  const year = periodStart.getUTCFullYear()
  const startMonth = periodStart.getUTCMonth() + 1
  const yearOf = (month: number) => year + (month < startMonth ? 1 : 0)
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
