import { describe, expect, it } from 'vitest'
import {
  collectionByMethod,
  familiesOutstanding,
  monthlyCollection,
  type StatsEnrollment,
  type StatsPayment,
  summarizePayments,
} from '../payment-stats'

function payment(overrides: Partial<StatsPayment> = {}): StatsPayment {
  return {
    amount: 90,
    method: 'CASH',
    paidAt: new Date('2026-09-12T00:00:00.000Z'),
    cashedAt: null,
    ...overrides,
  }
}

function enrollment(overrides: Partial<StatsEnrollment> = {}): StatsEnrollment {
  return {
    totalAmount: 180,
    family: { id: 'family-1', name: 'Diallo' },
    payments: [],
    ...overrides,
  }
}

describe('summarizePayments', () => {
  it('reports nothing due on an empty school', () => {
    expect(summarizePayments([])).toMatchObject({
      due: 0,
      collected: 0,
      remaining: 0,
      collectionRate: 0,
      outstandingCount: 0,
    })
  })

  it('splits a partly paid school into collected and remaining', () => {
    const totals = summarizePayments([
      enrollment({ payments: [payment({ amount: 180 })] }),
      enrollment({ payments: [payment({ amount: 60 })] }),
      enrollment(),
    ])

    expect(totals).toMatchObject({
      due: 540,
      collected: 240,
      remaining: 300,
      enrollmentCount: 3,
      settledCount: 1,
      outstandingCount: 2,
      paymentCount: 2,
    })
    expect(totals.collectionRate).toBeCloseTo(44.4, 1)
  })

  it('keeps an overpaid enrollment from erasing another one debt', () => {
    const totals = summarizePayments([
      enrollment({ payments: [payment({ amount: 300 })] }),
      enrollment(),
    ])

    expect(totals.remaining).toBe(180)
    expect(totals.collected).toBe(300)
    expect(totals.collectionRate).toBe(50)
  })

  it('counts only uncashed cheques as awaiting cashing', () => {
    const totals = summarizePayments([
      enrollment({
        payments: [
          payment({ method: 'CHECK', amount: 120, cashedAt: null }),
          payment({ method: 'CHECK', amount: 40, cashedAt: new Date('2026-09-20T00:00:00.000Z') }),
          payment({ method: 'CASH', amount: 20, cashedAt: null }),
        ],
      }),
    ])

    expect(totals.uncashedAmount).toBe(120)
    expect(totals.uncashedCount).toBe(1)
  })
})

describe('monthlyCollection', () => {
  it('fills the months without any payment', () => {
    const series = monthlyCollection(
      [
        payment({ amount: 100, paidAt: new Date('2026-07-03T00:00:00.000Z') }),
        payment({ amount: 50, paidAt: new Date('2026-09-01T00:00:00.000Z') }),
        payment({ amount: 25, paidAt: new Date('2026-09-28T00:00:00.000Z') }),
      ],
      { months: 3 }
    )

    expect(series).toEqual([
      { month: '2026-07', amount: 100, count: 1 },
      { month: '2026-08', amount: 0, count: 0 },
      { month: '2026-09', amount: 75, count: 2 },
    ])
  })

  it('ends the window on the last payment, not on today', () => {
    const series = monthlyCollection([payment({ paidAt: new Date('2024-02-10T00:00:00.000Z') })], {
      months: 2,
      reference: new Date('2026-09-13T00:00:00.000Z'),
    })

    expect(series.map((point) => point.month)).toEqual(['2024-01', '2024-02'])
  })

  it('falls back on the reference month when nothing was paid', () => {
    const series = monthlyCollection([], {
      months: 2,
      reference: new Date('2026-09-13T00:00:00.000Z'),
    })

    expect(series).toEqual([
      { month: '2026-08', amount: 0, count: 0 },
      { month: '2026-09', amount: 0, count: 0 },
    ])
  })
})

describe('collectionByMethod', () => {
  it('ranks methods by collected amount and shares them out', () => {
    const breakdown = collectionByMethod([
      payment({ method: 'CASH', amount: 100 }),
      payment({ method: 'CHECK', amount: 250 }),
      payment({ method: 'CASH', amount: 150 }),
    ])

    expect(breakdown).toEqual([
      { method: 'CASH', amount: 250, count: 2, share: 50 },
      { method: 'CHECK', amount: 250, count: 1, share: 50 },
    ])
  })
})

describe('familiesOutstanding', () => {
  it('merges the enrollments of one family into a single debt', () => {
    const debts = familiesOutstanding([
      enrollment({ payments: [payment({ amount: 180 })] }),
      enrollment({ payments: [payment({ amount: 20 })] }),
    ])

    expect(debts).toEqual([
      {
        familyId: 'family-1',
        familyName: 'Diallo',
        due: 360,
        paid: 200,
        remaining: 160,
        collectionRate: 55.6,
      },
    ])
  })

  it('drops settled families and ranks the rest by debt', () => {
    const debts = familiesOutstanding([
      enrollment({ family: { id: 'a', name: 'Ahmed' }, payments: [payment({ amount: 180 })] }),
      enrollment({ family: { id: 'b', name: 'Bakary' }, payments: [payment({ amount: 30 })] }),
      enrollment({ family: { id: 'c', name: 'Camara' } }),
    ])

    expect(debts.map((debt) => debt.familyId)).toEqual(['c', 'b'])
  })

  it('ignores an enrollment attached to no family', () => {
    expect(familiesOutstanding([enrollment({ family: null })])).toEqual([])
  })

  it('keeps only the requested number of families', () => {
    const debts = familiesOutstanding(
      [
        enrollment({ family: { id: 'a', name: 'Ahmed' } }),
        enrollment({ family: { id: 'b', name: 'Bakary' }, payments: [payment({ amount: 30 })] }),
      ],
      1
    )

    expect(debts.map((debt) => debt.familyId)).toEqual(['a'])
  })
})
