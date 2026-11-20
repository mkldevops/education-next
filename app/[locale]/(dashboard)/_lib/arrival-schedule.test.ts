import { describe, expect, it } from 'vitest'
import type { PaymentSchedule } from '@/domain/payment-schedule'
import {
  arrivalInput,
  arrivalPeriod,
  arrivalSchedule,
  localToday,
  startMonthPreview,
} from './arrival-schedule'

const monthly: PaymentSchedule = { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 }
const plan = { amount: 1000, paymentSchedule: monthly }
const period = { startAt: '2026-09-01T00:00:00.000Z', endAt: '2027-06-30T00:00:00.000Z' }
const base = { startMonth: '', firstAmount: '', today: '2026-08-20' }

describe('arrivalSchedule', () => {
  it('lists the whole plan when no start month is chosen', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', base)

    expect(schedule?.months).toHaveLength(10)
    expect(schedule?.startMonth).toBe('2026-09')
    expect(schedule?.fullPeriod).toBe(true)
    expect(schedule?.pastFirstDue).toBe(false)
    expect(schedule?.owed).toBe(1000)
    expect(schedule?.installments).toHaveLength(10)
  })

  it('flags an arrival once the first due date has passed', () => {
    expect(
      arrivalSchedule(plan, period, 'EUR', { ...base, today: '2026-09-05' })?.pastFirstDue
    ).toBe(false)
    expect(
      arrivalSchedule(plan, period, 'EUR', { ...base, today: '2026-09-06' })?.pastFirstDue
    ).toBe(true)
  })

  it('owes only the installments from the chosen month', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', { ...base, startMonth: '2026-11' })

    expect(schedule?.fullPeriod).toBe(false)
    expect(schedule?.nominal).toBe(100)
    expect(schedule?.owed).toBe(800)
    expect(schedule?.installments.map((installment) => installment.amount)).toEqual(
      Array(8).fill(100)
    )
  })

  it('replaces the first month only, the following ones keep the plan amount', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', {
      ...base,
      startMonth: '2026-11',
      firstAmount: '50',
    })

    expect(schedule?.owed).toBe(750)
    expect(schedule?.installments.map((installment) => installment.amount)).toEqual([
      50,
      ...Array(7).fill(100),
    ])
  })

  it('ignores a first-month amount outside the plan installment', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', {
      ...base,
      startMonth: '2026-11',
      firstAmount: '150',
    })

    expect(schedule?.owed).toBe(800)
  })

  it('spreads a lower typed total over the months after the first one', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', {
      ...base,
      startMonth: '2027-04',
      firstAmount: '50',
      totalAmount: 230,
    })

    expect(schedule?.installments.map((installment) => installment.amount)).toEqual([50, 90, 90])
  })

  it('offers no first-month amount on a plan that is not monthly', () => {
    const quarterly: PaymentSchedule = { mode: 'QUARTERLY', firstMonth: 9, count: 3, dueDay: 1 }
    const schedule = arrivalSchedule({ amount: 900, paymentSchedule: quarterly }, period, 'EUR', {
      ...base,
      startMonth: '2026-12',
      firstAmount: '10',
    })

    expect(schedule?.monthly).toBe(false)
    expect(schedule?.months).toEqual(['2026-09', '2026-12', '2027-03'])
    expect(schedule?.owed).toBe(600)
    expect(arrivalInput(schedule ?? null, '10')).toEqual({
      startMonth: '2026-12',
      firstInstallmentAmount: null,
    })
  })

  it('has nothing to show without a schedule, a price or a period', () => {
    expect(
      arrivalSchedule({ amount: 1000, paymentSchedule: { mode: 'NONE' } }, period, 'EUR', base)
    ).toBeNull()
    expect(arrivalSchedule({ paymentSchedule: monthly }, period, 'EUR', base)).toBeNull()
    expect(arrivalSchedule(plan, null, 'EUR', base)).toBeNull()
    expect(arrivalSchedule(undefined, period, 'EUR', base)).toBeNull()
  })
})

describe('arrivalInput', () => {
  it('sends no start month for a plain enrollment over the whole period', () => {
    expect(arrivalInput(arrivalSchedule(plan, period, 'EUR', base), '')).toEqual({
      startMonth: null,
      firstInstallmentAmount: null,
    })
    expect(arrivalInput(null, '50')).toEqual({ startMonth: null, firstInstallmentAmount: null })
  })

  it('sends the first deadline month with a reduced first month', () => {
    expect(arrivalInput(arrivalSchedule(plan, period, 'EUR', base), '50')).toEqual({
      startMonth: '2026-09',
      firstInstallmentAmount: 50,
    })
  })

  it('sends an out-of-range amount as typed so the server refuses it', () => {
    const schedule = arrivalSchedule(plan, period, 'EUR', { ...base, startMonth: '2026-11' })

    expect(arrivalInput(schedule, '150')).toEqual({
      startMonth: '2026-11',
      firstInstallmentAmount: 150,
    })
  })
})

describe('arrivalPeriod', () => {
  const classes = [
    { id: 'a', name: 'A', periodStartAt: period.startAt, periodEndAt: period.endAt },
    { id: 'b', name: 'B', periodStartAt: period.startAt, periodEndAt: period.endAt },
  ]

  it('uses the period of the selected class', () => {
    expect(arrivalPeriod(classes, 'b')).toEqual(period)
  })

  it('falls back to the period every offered class shares', () => {
    expect(arrivalPeriod(classes, null)).toEqual(period)
    expect(
      arrivalPeriod(
        [
          ...classes,
          { id: 'c', name: 'C', periodStartAt: '2027-09-01', periodEndAt: '2028-06-30' },
        ],
        null
      )
    ).toBeNull()
    expect(arrivalPeriod([{ id: 'd', name: 'D' }], 'd')).toBeNull()
  })
})

describe('localToday', () => {
  it('formats the local calendar date', () => {
    expect(localToday(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
  })
})

describe('startMonthPreview', () => {
  const basis = {
    planAmount: 1000,
    paymentSchedule: monthly,
    periodStartAt: period.startAt,
    totalAmount: 1000,
    startMonth: null,
    firstInstallmentAmount: null,
  }
  const amounts = (installments: { amount: number }[]) =>
    installments.map((installment) => installment.amount)

  it('keeps the stored schedule before and owes from the new month after', () => {
    const preview = startMonthPreview(basis, 'EUR', {
      startMonth: '2026-11',
      firstAmount: '',
      discount: 0,
    })

    expect(amounts(preview?.previous ?? [])).toEqual(Array(10).fill(100))
    expect(preview?.installments[0].dueDate).toBe('2026-11-05')
    expect(amounts(preview?.installments ?? [])).toEqual(Array(8).fill(100))
    expect(preview?.nominal).toBe(100)
  })

  it('replaces the first month and spreads the discount over the following ones', () => {
    const preview = startMonthPreview(basis, 'EUR', {
      startMonth: '2027-04',
      firstAmount: '50',
      discount: 20,
    })

    expect(amounts(preview?.installments ?? [])).toEqual([50, 90, 90])
  })

  it('reads the stored first month amount in the schedule before', () => {
    const preview = startMonthPreview(
      { ...basis, totalAmount: 250, startMonth: '2027-04', firstInstallmentAmount: 50 },
      'EUR',
      { startMonth: null, firstAmount: '', discount: 0 }
    )

    expect(amounts(preview?.previous ?? [])).toEqual([50, 100, 100])
    expect(amounts(preview?.installments ?? [])).toEqual(Array(10).fill(100))
  })

  it('ignores a first month amount above the plan installment, left to the server to refuse', () => {
    const preview = startMonthPreview(basis, 'EUR', {
      startMonth: '2027-04',
      firstAmount: '150',
      discount: 0,
    })

    expect(amounts(preview?.installments ?? [])).toEqual([100, 100, 100])
  })

  it('has nothing to show when no installment is owed from the month', () => {
    expect(
      startMonthPreview(basis, 'EUR', { startMonth: '2027-07', firstAmount: '', discount: 0 })
    ).toBeNull()
  })
})
