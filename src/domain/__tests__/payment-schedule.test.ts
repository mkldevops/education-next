import { describe, expect, it } from 'vitest'
import {
  annualPlanAmount,
  paymentInstallments,
  paymentScheduleSchema,
  paymentTracking,
  planPricingSchema,
  readPaymentSchedule,
  readPlanPricing,
} from '../payment-schedule'

const start = new Date('2026-09-01T00:00:00Z')

describe('plan pricing', () => {
  it('converts a monthly price into one annual amount without float residue', () => {
    expect(annualPlanAmount({ mode: 'MONTHLY', amount: 30.3, months: 10 })).toBe(303)
    expect(annualPlanAmount({ mode: 'ANNUAL', amount: 400 })).toBe(400)
  })

  it('rejects invalid monthly counts, precision and database overflow', () => {
    for (const pricing of [
      { mode: 'MONTHLY', amount: 30, months: 0 },
      { mode: 'MONTHLY', amount: 30, months: 13 },
      { mode: 'ANNUAL', amount: 30.123 },
      { mode: 'MONTHLY', amount: 99_999_999, months: 12 },
    ])
      expect(planPricingSchema.safeParse(pricing).success).toBe(false)
  })

  it('reads old plans as annual with no tracking, and distrusts stale price metadata', () => {
    expect(readPlanPricing(null, 300)).toEqual({ mode: 'ANNUAL', amount: 300 })
    expect(readPlanPricing({ mode: 'MONTHLY', amount: 30, months: 10 }, 400)).toEqual({
      mode: 'ANNUAL',
      amount: 400,
    })
    expect(readPaymentSchedule(null)).toEqual({ mode: 'NONE' })
    expect(readPaymentSchedule({ mode: 'MONTHLY', count: -1 })).toEqual({ mode: 'NONE' })
  })
})

describe('payment deadlines', () => {
  it('anchors months to the enrollment year and crosses January', () => {
    const rows = paymentInstallments(
      { mode: 'MONTHLY', firstMonth: 11, count: 4, dueDay: 10 },
      100,
      start,
      'EUR'
    )
    expect(rows).toEqual([
      { dueDate: '2026-11-10', amount: 25 },
      { dueDate: '2026-12-10', amount: 25 },
      { dueDate: '2027-01-10', amount: 25 },
      { dueDate: '2027-02-10', amount: 25 },
    ])
    expect(
      paymentInstallments(
        { mode: 'MONTHLY', firstMonth: 1, count: 1, dueDay: 10 },
        100,
        start,
        'EUR'
      )[0].dueDate
    ).toBe('2027-01-10')
  })

  it('uses quarterly dates and clamps the deadline in short and leap months', () => {
    expect(
      paymentInstallments(
        { mode: 'QUARTERLY', firstMonth: 11, count: 4, dueDay: 31 },
        100,
        start,
        'EUR'
      ).map((row) => row.dueDate)
    ).toEqual(['2026-11-30', '2027-02-28', '2027-05-31', '2027-08-31'])
    expect(
      paymentInstallments(
        { mode: 'MONTHLY', firstMonth: 2, count: 1, dueDay: 31 },
        100,
        new Date('2027-09-01T00:00:00Z'),
        'EUR'
      )[0].dueDate
    ).toBe('2028-02-29')
  })

  it('orders custom dates within the school year and balances rounding on the last one', () => {
    expect(
      paymentInstallments(
        {
          mode: 'INSTALLMENTS',
          dates: [
            { month: 1, day: 10 },
            { month: 9, day: 15 },
            { month: 11, day: 10 },
          ],
        },
        100,
        start,
        'EUR'
      )
    ).toEqual([
      { dueDate: '2026-09-15', amount: 33.33 },
      { dueDate: '2026-11-10', amount: 33.33 },
      { dueDate: '2027-01-10', amount: 33.34 },
    ])
    expect(
      paymentInstallments(
        { mode: 'MONTHLY', firstMonth: 9, count: 3, dueDay: 10 },
        100,
        start,
        'KMF'
      ).map((row) => row.amount)
    ).toEqual([33, 33, 34])
  })

  it('enforces the selected mode limits and unique custom dates', () => {
    for (const schedule of [
      { mode: 'MONTHLY', firstMonth: 9, count: 13, dueDay: 10 },
      { mode: 'QUARTERLY', firstMonth: 9, count: 5, dueDay: 10 },
      { mode: 'INSTALLMENTS', dates: [] },
      {
        mode: 'INSTALLMENTS',
        dates: Array.from({ length: 6 }, (_, index) => ({ month: index + 1, day: 1 })),
      },
      {
        mode: 'INSTALLMENTS',
        dates: [
          { month: 9, day: 10 },
          { month: 9, day: 10 },
        ],
      },
    ])
      expect(paymentScheduleSchema.safeParse(schedule).success).toBe(false)
  })

  it('does not round up legacy fractional KMF debt when splitting its schedule', () => {
    expect(
      paymentInstallments(
        { mode: 'MONTHLY', firstMonth: 9, count: 3, dueDay: 10 },
        100.5,
        start,
        'KMF'
      ).map((row) => row.amount)
    ).toEqual([33, 33, 34.5])
  })

  it('compares cumulative expected and paid amounts only after the deadline', () => {
    const rows = paymentInstallments(
      { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 10 },
      1000,
      start,
      'EUR'
    )
    expect(paymentTracking(rows, 0, '2026-09-10')).toEqual({
      expectedToDate: 0,
      overdueAmount: 0,
      tracked: true,
    })
    expect(paymentTracking(rows, 250, '2026-11-11')).toEqual({
      expectedToDate: 300,
      overdueAmount: 50,
      tracked: true,
    })
    expect(paymentTracking(rows, 400, '2026-11-11').overdueAmount).toBe(0)
    expect(paymentTracking(rows, 999.99, '2028-01-01').overdueAmount).toBe(0.01)
    expect(paymentTracking([], 0, '2028-01-01')).toEqual({
      expectedToDate: 0,
      overdueAmount: 0,
      tracked: false,
    })
  })
})
