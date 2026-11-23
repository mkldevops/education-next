import { describe, expect, it } from 'vitest'
import {
  annualPlanAmount,
  firstInstallmentAmountSchema,
  firstInstallmentFitsTotal,
  installmentCoverage,
  owedPlanAmount,
  owedThroughMonth,
  paymentInstallments,
  paymentScheduleSchema,
  paymentTracking,
  planPricingSchema,
  readPaymentSchedule,
  readPlanPricing,
  startMonthFromDate,
  startMonthSchema,
  startMonthToDate,
  validateStartMonth,
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

describe('enrollment start month', () => {
  const monthly = { mode: 'MONTHLY', firstMonth: 9, count: 9, dueDay: 5 } as const
  const period = { startAt: start, endAt: new Date('2027-06-30T00:00:00Z') }

  it('owes only the installments from the start month: October on a September–May plan', () => {
    expect(owedPlanAmount(144_000, monthly, start, 'XOF', { startMonth: '2026-10' })).toBe(128_000)
    const installments = paymentInstallments(monthly, 128_000, start, 'XOF', {
      startMonth: '2026-10',
    })
    expect(installments).toHaveLength(8)
    expect(installments[0]).toEqual({ dueDate: '2026-10-05', amount: 16_000 })
    expect(installments.every((installment) => installment.amount === 16_000)).toBe(true)
  })

  it('expects nothing for September, then October once due', () => {
    const installments = paymentInstallments(monthly, 128_000, start, 'XOF', {
      startMonth: '2026-10',
    })
    expect(paymentTracking(installments, 0, '2026-10-01').overdueAmount).toBe(0)
    expect(paymentTracking(installments, 0, '2026-10-06').overdueAmount).toBe(16_000)
  })

  it('keeps today’s schedule without a start month or from the period start', () => {
    expect(owedPlanAmount(144_000, monthly, start, 'XOF', { startMonth: null })).toBe(144_000)
    expect(owedPlanAmount(144_000, monthly, start, 'XOF', { startMonth: '2026-09' })).toBe(144_000)
    expect(paymentInstallments(monthly, 144_000, start, 'XOF', { startMonth: null })).toEqual(
      paymentInstallments(monthly, 144_000, start, 'XOF')
    )
  })

  it('refuses a plan without deadlines and a start after the last one', () => {
    expect(owedPlanAmount(144_000, { mode: 'NONE' }, start, 'XOF', { startMonth: '2026-10' })).toBe(
      'noPaymentSchedule'
    )
    expect(owedPlanAmount(144_000, monthly, start, 'XOF', { startMonth: '2027-06' })).toBe(
      'noInstallmentDue'
    )
  })

  it('keeps the start month inside the school period', () => {
    expect(validateStartMonth('2026-09', period)).toBe('OK')
    expect(validateStartMonth('2027-06', period)).toBe('OK')
    expect(validateStartMonth('2026-08', period)).toBe('startMonthOutsidePeriod')
    expect(validateStartMonth('2027-07', period)).toBe('startMonthOutsidePeriod')
  })

  it('reads and stores a month as its first day in UTC', () => {
    expect(startMonthSchema.safeParse('2026-10').success).toBe(true)
    expect(startMonthSchema.safeParse('2026-13').success).toBe(false)
    expect(startMonthSchema.safeParse('2026-10-01').success).toBe(false)
    expect(startMonthToDate('2026-10').toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(startMonthFromDate(startMonthToDate('2026-10'))).toBe('2026-10')
    expect(startMonthFromDate(null)).toBeNull()
  })
})

describe('student departure (end month)', () => {
  const monthly = { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 } as const

  it('owes the installments due up to the last month of presence', () => {
    // 10 × 100 € from September to June; leaving after December keeps 4 installments.
    expect(
      owedThroughMonth(monthly, 1000, start, 'EUR', { startMonth: null, endMonth: '2026-12' })
    ).toEqual({
      amount: 400,
      prorated: true,
    })
  })

  it('combines the start month and the end month', () => {
    // Started in October: 900 € over 9 installments; leaving after December keeps 3.
    expect(
      owedThroughMonth(monthly, 900, start, 'EUR', { startMonth: '2026-10', endMonth: '2026-12' })
        .amount
    ).toBe(300)
  })

  it('keeps the cent remainder on the kept installments without inventing debt', () => {
    // 100 € over 3 installments: 33.33, 33.33, 33.34. The first two make 66.66.
    const threeMonths = { mode: 'MONTHLY', firstMonth: 9, count: 3, dueDay: 5 } as const
    expect(
      owedThroughMonth(threeMonths, 100, start, 'EUR', { startMonth: null, endMonth: '2026-10' })
        .amount
    ).toBe(66.66)
    expect(
      owedThroughMonth(threeMonths, 100, start, 'EUR', { startMonth: null, endMonth: '2026-11' })
        .amount
    ).toBe(100)
  })

  it('cannot prorate a plan without deadlines or an enrollment without a period', () => {
    expect(
      owedThroughMonth({ mode: 'NONE' }, 1000, start, 'EUR', {
        startMonth: null,
        endMonth: '2026-12',
      })
    ).toEqual({
      amount: 1000,
      prorated: false,
    })
    expect(
      owedThroughMonth(monthly, 1000, null, 'EUR', { startMonth: null, endMonth: '2026-12' })
    ).toEqual({
      amount: 1000,
      prorated: false,
    })
  })

  it('owes nothing when leaving before the first deadline', () => {
    expect(
      owedThroughMonth(monthly, 1000, start, 'EUR', { startMonth: null, endMonth: '2026-08' })
        .amount
    ).toBe(0)
  })

  it('drops the deadlines after the end month and splits the cut total the same way', () => {
    const installments = paymentInstallments(monthly, 400, start, 'EUR', { endMonth: '2026-12' })
    expect(installments).toEqual([
      { dueDate: '2026-09-05', amount: 100 },
      { dueDate: '2026-10-05', amount: 100 },
      { dueDate: '2026-11-05', amount: 100 },
      { dueDate: '2026-12-05', amount: 100 },
    ])
    expect(paymentTracking(installments, 0, '2027-03-01').overdueAmount).toBe(400)
  })
})

describe('installment coverage', () => {
  const installments = paymentInstallments(
    { mode: 'MONTHLY', firstMonth: 9, count: 9, dueDay: 10 },
    144000,
    start,
    'KMF'
  )

  it('settles the deadlines in date order and flags the partial one', () => {
    const coverage = installmentCoverage(installments, 88000)

    expect(coverage.slice(0, 6).map((row) => [row.dueDate, row.status, row.paidAmount])).toEqual([
      ['2026-09-10', 'PAID', 16000],
      ['2026-10-10', 'PAID', 16000],
      ['2026-11-10', 'PAID', 16000],
      ['2026-12-10', 'PAID', 16000],
      ['2027-01-10', 'PAID', 16000],
      ['2027-02-10', 'PARTIAL', 8000],
    ])
    expect(coverage.slice(6).every((row) => row.status === 'UNPAID')).toBe(true)
  })

  it('leaves every deadline unpaid without payment and caps an overpayment', () => {
    expect(installmentCoverage(installments, 0).every((row) => row.status === 'UNPAID')).toBe(true)
    expect(installmentCoverage(installments, 200000).every((row) => row.status === 'PAID')).toBe(
      true
    )
  })
})

describe('reduced first installment of an arrival during the year', () => {
  // 10 000 a month from October to July, due on the last day of the month.
  const monthly = { mode: 'MONTHLY', firstMonth: 10, count: 10, dueDay: 31 } as const
  const plan = 100_000
  const owed = (startMonth: string | null, firstInstallmentAmount: number | null) =>
    owedPlanAmount(plan, monthly, start, 'XOF', { startMonth, firstInstallmentAmount })
  const schedule = (total: number, startMonth: string, firstInstallmentAmount: number | null) =>
    paymentInstallments(monthly, total, start, 'XOF', { startMonth, firstInstallmentAmount })

  it('arrived mid-December: 5 000 then seven full months', () => {
    expect(owed('2026-12', 5_000)).toBe(75_000)
    const installments = schedule(75_000, '2026-12', 5_000)
    expect(installments.map((installment) => installment.amount)).toEqual([
      5_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000,
    ])
    expect(installments[0].dueDate).toBe('2026-12-31')
  })

  it('joined mid-October, paid 12 500: 2 500 is due once November has closed', () => {
    expect(owed('2026-10', 5_000)).toBe(95_000)
    const installments = schedule(95_000, '2026-10', 5_000)
    expect(installments.slice(0, 2)).toEqual([
      { dueDate: '2026-10-31', amount: 5_000 },
      { dueDate: '2026-11-30', amount: 10_000 },
    ])
    expect(paymentTracking(installments, 12_500, '2026-12-01')).toMatchObject({
      expectedToDate: 15_000,
      overdueAmount: 2_500,
    })
  })

  it('back at the end of October, paid 10 000: 2 500 is due once November has closed', () => {
    expect(owed('2026-10', 2_500)).toBe(92_500)
    const installments = schedule(92_500, '2026-10', 2_500)
    expect(paymentTracking(installments, 10_000, '2026-12-01')).toMatchObject({
      expectedToDate: 12_500,
      overdueAmount: 2_500,
    })
  })

  it('spreads a discount over the following installments only', () => {
    // 95 000 owed, 9 000 off: the first month keeps 5 000, the nine others share 81 000.
    const installments = schedule(86_000, '2026-10', 5_000)
    expect(installments[0].amount).toBe(5_000)
    expect(installments.slice(1).every((installment) => installment.amount === 9_000)).toBe(true)
  })

  it('rounds in minor units and leaves the remainder on the last installment', () => {
    const threeMonths = { mode: 'MONTHLY', firstMonth: 10, count: 3, dueDay: 5 } as const
    const installments = paymentInstallments(threeMonths, 110.01, start, 'EUR', {
      startMonth: '2026-10',
      firstInstallmentAmount: 10,
    })
    expect(installments.map((installment) => installment.amount)).toEqual([10, 50, 50.01])
  })

  it('never yields a negative installment once a departure cut the total', () => {
    // Left after December with 3 000 paid and the rest written off: less than the first month.
    const cut = paymentInstallments(monthly, 3_000, start, 'XOF', {
      startMonth: '2026-10',
      endMonth: '2026-12',
      firstInstallmentAmount: 5_000,
    })
    expect(cut.map((installment) => installment.amount)).toEqual([3_000, 0, 0])
  })

  it('puts the whole total on a single remaining deadline', () => {
    const single = paymentInstallments(monthly, 8_000, start, 'XOF', {
      startMonth: '2026-10',
      endMonth: '2026-10',
      firstInstallmentAmount: 5_000,
    })
    expect(single).toEqual([{ dueDate: '2026-10-31', amount: 8_000 }])
  })

  it('re-splits a departure on the reduced schedule', () => {
    // Joined in October at 5 000, left after December: 5 000 + 10 000 + 10 000 stay owed.
    const through = owedThroughMonth(monthly, 95_000, start, 'XOF', {
      startMonth: '2026-10',
      endMonth: '2026-12',
      firstInstallmentAmount: 5_000,
    })
    expect(through).toEqual({ amount: 25_000, prorated: true })
    const kept = paymentInstallments(monthly, through.amount, start, 'XOF', {
      startMonth: '2026-10',
      endMonth: '2026-12',
      firstInstallmentAmount: 5_000,
    })
    expect(kept.map((installment) => installment.amount)).toEqual([5_000, 10_000, 10_000])
  })

  it('requires a start month and a monthly plan', () => {
    expect(owed(null, 5_000)).toBe('firstInstallmentRequiresStartMonth')
    const quarterly = { mode: 'QUARTERLY', firstMonth: 10, count: 3, dueDay: 5 } as const
    expect(
      owedPlanAmount(plan, quarterly, start, 'XOF', {
        startMonth: '2026-10',
        firstInstallmentAmount: 5_000,
      })
    ).toBe('firstInstallmentNotMonthly')
  })

  it('keeps the amount within the installment it replaces', () => {
    expect(owed('2026-10', 10_000)).toBe(100_000)
    expect(owed('2026-10', 10_001)).toBe('firstInstallmentOutOfRange')
    expect(owed('2026-10', 0)).toBe('firstInstallmentOutOfRange')
    expect(owed('2026-10', -1)).toBe('firstInstallmentOutOfRange')
    expect(firstInstallmentAmountSchema.safeParse(0).success).toBe(false)
    expect(firstInstallmentAmountSchema.safeParse(2_500).success).toBe(true)
  })

  it('keeps the amount within the total the discount leaves', () => {
    expect(firstInstallmentFitsTotal(null, 0)).toBe(true)
    expect(firstInstallmentFitsTotal(5_000, 5_000)).toBe(true)
    expect(firstInstallmentFitsTotal(5_000, 4_999)).toBe(false)
  })

  it('leaves the plan schedule untouched without a first installment', () => {
    expect(owed('2026-12', null)).toBe(80_000)
    expect(schedule(80_000, '2026-12', null)).toEqual(
      paymentInstallments(monthly, 80_000, start, 'XOF', { startMonth: '2026-12' })
    )
  })
})
