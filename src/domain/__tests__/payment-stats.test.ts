import { describe, expect, it } from 'vitest'
import {
  collectionByMethod,
  type DatedAmount,
  familiesOutstanding,
  monthlyCollection,
  monthWindow,
  type StatsEnrollment,
  summarizePayments,
} from '../payment-stats'

const NO_CHEQUE = { amount: null, count: 0 }

function enrollment(overrides: Partial<StatsEnrollment> = {}): StatsEnrollment {
  return {
    totalAmount: 180,
    paid: null,
    family: { id: 'family-1', name: 'Diallo' },
    ...overrides,
  }
}

function dated(amount: number, paidAt: string): DatedAmount {
  return { amount, paidAt: new Date(paidAt) }
}

describe('summarizePayments', () => {
  it('reports nothing due on an empty school', () => {
    expect(summarizePayments([], [], NO_CHEQUE)).toMatchObject({
      due: 0,
      collected: 0,
      remaining: 0,
      collectionRate: 0,
      outstandingCount: 0,
      paymentCount: 0,
    })
  })

  it('splits a partly paid school into collected and remaining', () => {
    const totals = summarizePayments(
      [enrollment({ paid: 180 }), enrollment({ paid: 60 }), enrollment()],
      [{ method: 'CASH', amount: 240, count: 2 }],
      NO_CHEQUE
    )

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
    const totals = summarizePayments([enrollment({ paid: 300 }), enrollment()], [], NO_CHEQUE)

    expect(totals.remaining).toBe(180)
    expect(totals.collected).toBe(300)
    expect(totals.collectionRate).toBe(50)
  })

  it('reports the cheques awaiting cashing', () => {
    const totals = summarizePayments([enrollment()], [], { amount: 120, count: 1 })

    expect(totals.uncashedAmount).toBe(120)
    expect(totals.uncashedCount).toBe(1)
  })
})

describe('monthWindow', () => {
  const reference = new Date('2026-09-13T00:00:00.000Z')

  it('ends on the last payment, not on today', () => {
    const window = monthWindow(new Date('2024-02-10T00:00:00.000Z'), { months: 2, reference })

    expect(window).toEqual({
      from: new Date('2024-01-01T00:00:00.000Z'),
      to: new Date('2024-03-01T00:00:00.000Z'),
      months: 2,
    })
  })

  it('never runs past the current month on a future-dated payment', () => {
    const window = monthWindow(new Date('2031-05-01T00:00:00.000Z'), { months: 2, reference })

    expect(window.from).toEqual(new Date('2026-08-01T00:00:00.000Z'))
    expect(window.to).toEqual(new Date('2026-10-01T00:00:00.000Z'))
  })

  it('falls back on the reference month when nothing was paid', () => {
    expect(monthWindow(null, { months: 2, reference }).from).toEqual(
      new Date('2026-08-01T00:00:00.000Z')
    )
  })
})

describe('monthlyCollection', () => {
  const window = {
    from: new Date('2026-07-01T00:00:00.000Z'),
    to: new Date('2026-10-01T00:00:00.000Z'),
    months: 3,
  }

  it('fills the months without any payment', () => {
    const series = monthlyCollection(
      [
        dated(100, '2026-07-03T00:00:00.000Z'),
        dated(50, '2026-09-01T00:00:00.000Z'),
        dated(25, '2026-09-28T00:00:00.000Z'),
      ],
      window
    )

    expect(series).toEqual([
      { month: '2026-07', amount: 100, count: 1 },
      { month: '2026-08', amount: 0, count: 0 },
      { month: '2026-09', amount: 75, count: 2 },
    ])
  })

  it('slices months in UTC, whatever the server time zone', () => {
    const series = monthlyCollection(
      [dated(40, '2026-09-01T00:30:00.000Z'), dated(10, '2026-08-31T23:30:00.000Z')],
      window
    )

    expect(series.map((point) => point.amount)).toEqual([0, 10, 40])
  })

  it('ignores payments outside the window', () => {
    const series = monthlyCollection(
      [dated(40, '2026-06-30T00:00:00.000Z'), dated(10, '2031-05-01T00:00:00.000Z')],
      window
    )

    expect(series.every((point) => point.count === 0)).toBe(true)
  })
})

describe('collectionByMethod', () => {
  it('ranks methods by collected amount and shares them out', () => {
    const breakdown = collectionByMethod([
      { method: 'CHECK', amount: 250, count: 1 },
      { method: 'CASH', amount: 250, count: 2 },
      { method: 'CARD', amount: null, count: 0 },
    ])

    expect(breakdown).toEqual([
      { method: 'CASH', amount: 250, count: 2, share: 50 },
      { method: 'CHECK', amount: 250, count: 1, share: 50 },
      { method: 'CARD', amount: 0, count: 0, share: 0 },
    ])
  })
})

describe('familiesOutstanding', () => {
  it('merges the enrollments of one family into a single debt', () => {
    const debts = familiesOutstanding([enrollment({ paid: 180 }), enrollment({ paid: 20 })])

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
      enrollment({ family: { id: 'a', name: 'Ahmed' }, paid: 180 }),
      enrollment({ family: { id: 'b', name: 'Bakary' }, paid: 30 }),
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
        enrollment({ family: { id: 'b', name: 'Bakary' }, paid: 30 }),
      ],
      1
    )

    expect(debts.map((debt) => debt.familyId)).toEqual(['a'])
  })
})
