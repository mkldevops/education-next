import { describe, expect, it } from 'vitest'
import {
  amountForDays,
  computeCoverage,
  type MealLedgerEntry,
  previewMealPayment,
  replayLedger,
  servedDays,
  servedDaysThrough,
  validateMealWeekdays,
} from './meal-ledger'

const CANTEEN = [1, 2, 3, 4]
const PERIOD_END = '2027-06-30'
const CLOSED = new Set(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-12'])
const isClosed = (day: string) => CLOSED.has(day)
const pay = (amount: number, unitPrice = 750): MealLedgerEntry => ({
  kind: 'payment',
  amount,
  unitPrice,
})

function served(weekdays: number[], startOn: string, absences?: Set<string>) {
  return servedDays({
    segments: [{ weekdays, startOn, endOn: null }],
    periodEnd: PERIOD_END,
    isClosed,
    absences,
  })
}

describe('validateMealWeekdays', () => {
  it('accepts a non-empty subset of the allowed days', () => {
    expect(validateMealWeekdays([3])).toBe('OK')
    expect(validateMealWeekdays([1, 4], CANTEEN)).toBe('OK')
  })

  it('rejects empty, duplicated or disallowed days', () => {
    expect(validateMealWeekdays([])).toBe('invalidWeekdays')
    expect(validateMealWeekdays([2, 2])).toBe('invalidWeekdays')
    expect(validateMealWeekdays([5], CANTEEN)).toBe('invalidWeekdays')
    expect(validateMealWeekdays([0])).toBe('invalidWeekdays')
  })
})

describe('servedDays', () => {
  it('never counts a Friday for the canteen, but does for the snack', () => {
    expect(served(CANTEEN, '2026-10-26').slice(0, 5)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-11-02',
    ])
    expect(served([1, 2, 3, 4, 5], '2026-10-26')).toContain('2026-10-30')
  })

  it('skips closures and absences', () => {
    const days = served(CANTEEN, '2026-11-02', new Set(['2026-11-10']))
    expect(days.slice(0, 4)).toEqual(['2026-11-02', '2026-11-03', '2026-11-09', '2026-11-11'])
  })

  it('bounds an open segment by the period end and a closed one by its own end', () => {
    expect(served(CANTEEN, '2027-06-28')).toEqual(['2027-06-28', '2027-06-29', '2027-06-30'])
    expect(
      servedDays({
        segments: [
          { weekdays: [1], startOn: '2026-10-26', endOn: '2026-11-02' },
          { weekdays: [3], startOn: '2026-11-03', endOn: '2026-11-18' },
        ],
        periodEnd: PERIOD_END,
        isClosed,
      })
    ).toEqual(['2026-10-26', '2026-11-02', '2026-11-11', '2026-11-18'])
  })
})

describe('replayLedger', () => {
  it('turns money into whole days and carries the remainder (R1)', () => {
    expect(replayLedger([pay(2250)])).toEqual({ days: 3, credit: 0, lastUnitPrice: 750 })
    expect(replayLedger([pay(2500)])).toEqual({ days: 3, credit: 250, lastUnitPrice: 750 })
    expect(replayLedger([pay(2500), pay(500)])).toEqual({ days: 4, credit: 0, lastUnitPrice: 750 })
  })

  it('keeps days bought before a price rise', () => {
    expect(replayLedger([pay(1500, 750), pay(2000, 1000)]).days).toBe(4)
  })

  it('ignores a cancelled payment without a negative credit (R8)', () => {
    expect(replayLedger([{ ...pay(1500), cancelled: true } as MealLedgerEntry, pay(750)])).toEqual({
      days: 1,
      credit: 0,
      lastUnitPrice: 750,
    })
  })

  it('adds signed adjustment days (R10)', () => {
    expect(
      replayLedger([pay(1500), { kind: 'adjustment', days: 2 }, { kind: 'adjustment', days: -1 }])
        .days
    ).toBe(3)
  })

  it('counts cents exactly for a decimal currency', () => {
    expect(replayLedger([pay(0.3, 0.1)])).toEqual({ days: 3, credit: 0, lastUnitPrice: 0.1 })
  })
})

describe('computeCoverage', () => {
  const canteen = served(CANTEEN, '2026-10-26')

  it('pays through the last covered served day (criterion 1)', () => {
    const coverage = computeCoverage({
      served: canteen,
      ledger: replayLedger([pay(2250)]),
      today: '2026-10-26',
      unitPrice: 750,
    })
    expect(coverage).toMatchObject({ paidThrough: '2026-10-28', coveredLeft: 3, dueDays: 0 })
  })

  it('covers four Wednesdays around a closure (criterion 4)', () => {
    const snack = served([3], '2026-11-02')
    const coverage = computeCoverage({
      served: snack,
      ledger: replayLedger([pay(2000, 500)]),
      today: '2026-11-02',
      unitPrice: 500,
    })
    expect(snack.slice(0, 4)).toEqual(['2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02'])
    expect(coverage.paidThrough).toBe('2026-12-02')
  })

  it('pushes paid-through when a closure or an absence lands on a covered day (5, 6)', () => {
    const ledger = replayLedger([pay(2250)])
    const later = (days: string[]) =>
      computeCoverage({ served: days, ledger, today: '2026-10-26', unitPrice: 750 }).paidThrough
    expect(later(served(CANTEEN, '2026-10-26', new Set(['2026-10-27'])))).toBe('2026-10-29')
    expect(
      later(
        servedDays({
          segments: [{ weekdays: CANTEEN, startOn: '2026-10-26', endOn: null }],
          periodEnd: PERIOD_END,
          isClosed: (day) => day === '2026-10-28' || isClosed(day),
        })
      )
    ).toBe('2026-10-29')
  })

  it('charges due days at today price minus the credit, then settles to zero (criterion 7)', () => {
    const january = served(CANTEEN, '2027-01-04')
    const entries = [pay(1750, 750)]
    const before = computeCoverage({
      served: january,
      ledger: replayLedger(entries),
      today: '2027-01-07',
      unitPrice: 1000,
    })
    expect(before).toMatchObject({ dueDays: 2, credit: 250, dueAmount: 1750 })

    const after = computeCoverage({
      served: january,
      ledger: replayLedger([...entries, pay(before.dueAmount, 1000)]),
      today: '2027-01-07',
      unitPrice: 1000,
    })
    expect(after).toMatchObject({ dueDays: 0, dueAmount: 0, credit: 0 })
  })

  it('makes eaten days due again once their payment is cancelled (criterion 8)', () => {
    const coverage = computeCoverage({
      served: canteen,
      ledger: replayLedger([{ ...pay(1500), cancelled: true } as MealLedgerEntry, pay(750)]),
      today: '2026-10-28',
      unitPrice: 750,
    })
    expect(coverage).toMatchObject({ paidThrough: '2026-10-26', dueDays: 2, dueAmount: 1500 })
  })

  it('converts an opening « paid through » into days (criterion 12)', () => {
    const fromSeptember = served(CANTEEN, '2026-10-19')
    const days = servedDaysThrough(fromSeptember, '2026-10-30')
    const coverage = computeCoverage({
      served: fromSeptember,
      ledger: replayLedger([{ kind: 'adjustment', days }]),
      today: '2026-10-30',
      unitPrice: 750,
    })
    expect(days).toBe(8)
    expect(coverage).toMatchObject({ paidThrough: '2026-10-29', dueDays: 0, dueAmount: 0 })
  })

  it('values unconsumed days and the credit once every served day is covered (R11)', () => {
    const stopped = servedDays({
      segments: [{ weekdays: CANTEEN, startOn: '2026-10-26', endOn: '2026-10-27' }],
      periodEnd: PERIOD_END,
      isClosed,
    })
    const coverage = computeCoverage({
      served: stopped,
      ledger: replayLedger([pay(2500)]),
      today: '2026-10-27',
      unitPrice: 1000,
    })
    expect(coverage).toMatchObject({ paidThrough: '2026-10-27', surplusValue: 1000 })
  })

  it('reports no paid-through and every eaten day as due without any payment', () => {
    expect(
      computeCoverage({
        served: canteen,
        ledger: replayLedger([]),
        today: '2026-10-27',
        unitPrice: 750,
      })
    ).toEqual({
      paidThrough: null,
      coveredLeft: 0,
      dueDays: 2,
      dueAmount: 1500,
      credit: 0,
      surplusValue: 0,
    })
  })
})

describe('previewMealPayment', () => {
  const canteen = served(CANTEEN, '2026-10-26')

  it('warns about a remainder and a purchase shorter than a week (criterion 2)', () => {
    expect(
      previewMealPayment({
        served: canteen,
        ledger: replayLedger([]),
        amount: 2500,
        unitPrice: 750,
        daysPerWeek: 4,
      })
    ).toEqual({
      daysAdded: 3,
      newPaidThrough: '2026-10-28',
      remainder: 250,
      warnings: ['notMultiple', 'lessThanWeek'],
    })
  })

  it('uses the carried credit to complete a day', () => {
    expect(
      previewMealPayment({
        served: canteen,
        ledger: replayLedger([pay(2500)]),
        amount: 500,
        unitPrice: 750,
        daysPerWeek: 1,
      })
    ).toMatchObject({ daysAdded: 1, newPaidThrough: '2026-10-29', remainder: 0, warnings: [] })
  })

  it('warns when the purchase runs past the last served day of the period', () => {
    const lastDays = served(CANTEEN, '2027-06-28')
    expect(
      previewMealPayment({
        served: lastDays,
        ledger: replayLedger([]),
        amount: 3000,
        unitPrice: 750,
        daysPerWeek: 3,
      })
    ).toMatchObject({ daysAdded: 4, newPaidThrough: '2027-06-30', warnings: ['exceedsPeriod'] })
  })
})

describe('amountForDays', () => {
  it('deducts the credit and never goes below zero', () => {
    expect(amountForDays(4, 750, 250)).toBe(2750)
    expect(amountForDays(0, 750, 250)).toBe(0)
  })
})
