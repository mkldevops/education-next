import { describe, expect, it } from 'vitest'
import {
  chargeRemaining,
  coversMonth,
  dateToMonth,
  exceedsCharge,
  formatChildcareMonth,
  isChildcareMonth,
  isValidRange,
  monthToDate,
  planChildcareBilling,
  summarizeChildcare,
} from '../childcare'

const normal = { id: 'yahya', monthlyAmount: 6000, startMonth: '2026-10', endMonth: null }
const reduced = { id: 'an-ichat', monthlyAmount: 3000, startMonth: '2026-10', endMonth: null }

describe('childcare months', () => {
  it('accepts only a real month', () => {
    expect(isChildcareMonth('2026-11')).toBe(true)
    expect(isChildcareMonth('2026-13')).toBe(false)
    expect(isChildcareMonth('2026-11-01')).toBe(false)
  })

  it('round-trips through the database date', () => {
    expect(dateToMonth(monthToDate('2026-11'))).toBe('2026-11')
  })

  it('stays on the stored month whatever the locale', () => {
    expect(formatChildcareMonth('2026-11', 'fr')).toBe('novembre 2026')
  })

  it('covers the whole inclusive period', () => {
    const range = { startMonth: '2026-10', endMonth: '2026-12' }
    expect(coversMonth(range, '2026-09')).toBe(false)
    expect(coversMonth(range, '2026-10')).toBe(true)
    expect(coversMonth(range, '2026-12')).toBe(true)
    expect(coversMonth(range, '2027-01')).toBe(false)
    expect(coversMonth({ startMonth: '2026-10', endMonth: null }, '2030-01')).toBe(true)
  })

  it('rejects an end before the start', () => {
    expect(isValidRange({ startMonth: '2026-10', endMonth: '2026-09' })).toBe(false)
    expect(isValidRange({ startMonth: '2026-10', endMonth: '2026-10' })).toBe(true)
  })
})

describe('planChildcareBilling', () => {
  it('bills each child at their own monthly rate', () => {
    const plan = planChildcareBilling({
      month: '2026-11',
      subscriptions: [normal, reduced],
      charges: [],
    })

    expect(plan.toCreate).toEqual([
      { subscriptionId: 'yahya', amount: 6000 },
      { subscriptionId: 'an-ichat', amount: 3000 },
    ])
  })

  it('creates nothing on a replay', () => {
    const plan = planChildcareBilling({
      month: '2026-11',
      subscriptions: [normal],
      charges: [{ id: 'c', subscriptionId: 'yahya', cancelledAt: null }],
    })

    expect(plan).toEqual({ toCreate: [], toRevive: [], alreadyBilled: 1, outsideRange: 0 })
  })

  it('bills a cancelled month again at the current rate', () => {
    const plan = planChildcareBilling({
      month: '2026-11',
      subscriptions: [normal],
      charges: [{ id: 'c', subscriptionId: 'yahya', cancelledAt: new Date() }],
    })

    expect(plan.toRevive).toEqual([{ id: 'c', amount: 6000 }])
  })

  it('skips a child outside their period', () => {
    const plan = planChildcareBilling({
      month: '2026-09',
      subscriptions: [normal],
      charges: [],
    })

    expect(plan).toEqual({ toCreate: [], toRevive: [], alreadyBilled: 0, outsideRange: 1 })
  })
})

describe('childcare balance', () => {
  it('never goes below zero', () => {
    expect(chargeRemaining(6000, 2500)).toBe(3500)
    expect(chargeRemaining(6000, 7000)).toBe(0)
  })

  it('compares amounts to the cent', () => {
    expect(exceedsCharge(0.3, 0.1 + 0.2)).toBe(false)
    expect(exceedsCharge(6000.01, 6000)).toBe(true)
  })

  it('leaves cancelled months out of the totals', () => {
    expect(
      summarizeChildcare([
        { amount: 6000, paid: 6000, cancelled: false },
        { amount: 6000, paid: 2000, cancelled: false },
        { amount: 3000, paid: 0, cancelled: true },
      ])
    ).toEqual({ billed: 12000, paid: 8000, remaining: 4000 })
  })
})
