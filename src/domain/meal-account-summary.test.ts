import { describe, expect, it } from 'vitest'
import { summarizeMealAccount } from './meal-account-summary'

// Lundi, mardi, jeudi, vendredi depuis le lundi 7 septembre.
const segment = {
  id: 's',
  periodId: 'p',
  weekdays: [1, 2, 4, 5],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
}

describe('summarizeMealAccount', () => {
  it('counts what is due once the opening runs out', () => {
    const summary = summarizeMealAccount({
      segments: [segment],
      adjustments: [{ kind: 'OPENING', days: 4, reason: 'Cahier' }],
      payments: [],
      prices: [{ amount: 500, effectiveFrom: '2026-09-01' }],
      isClosed: () => false,
      today: '2026-09-14',
    })

    expect(summary.current?.id).toBe('s')
    expect(summary.opening).toEqual({ days: 4, reason: 'Cahier' })
    expect(summary.coverage.paidThrough).toBe('2026-09-11')
    expect(summary.coverage.dueDays).toBe(1)
    expect(summary.coverage.dueAmount).toBe(500)
  })

  it('shows nothing paid and no price before the first one', () => {
    const summary = summarizeMealAccount({
      segments: [segment],
      adjustments: [],
      payments: [],
      prices: [],
      isClosed: () => false,
      today: '2026-09-07',
    })

    expect(summary.coverage.paidThrough).toBeNull()
    expect(summary.unitPrice).toBeNull()
    expect(summary.coverage.dueAmount).toBe(0)
  })

  it('has no current segment once the service has stopped', () => {
    const summary = summarizeMealAccount({
      segments: [{ ...segment, endOn: '2026-09-11' }],
      adjustments: [],
      payments: [],
      prices: [],
      isClosed: () => false,
      today: '2026-09-14',
    })

    expect(summary.current).toBeNull()
  })

  it('adds payments after the opening and carries the remainder to the next one', () => {
    const summary = summarizeMealAccount({
      segments: [segment],
      adjustments: [{ kind: 'OPENING', days: 4, reason: 'Cahier' }],
      payments: [
        { amount: 750, unitPrice: 500 },
        { amount: 250, unitPrice: 500 },
      ],
      prices: [{ amount: 500, effectiveFrom: '2026-09-01' }],
      isClosed: () => false,
      today: '2026-09-14',
    })

    expect(summary.ledger).toEqual({ days: 6, credit: 0, lastUnitPrice: 500 })
    expect(summary.coverage.paidThrough).toBe('2026-09-15')
    expect(summary.coverage.dueDays).toBe(0)
  })
})
