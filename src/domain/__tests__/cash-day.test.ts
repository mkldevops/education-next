import { describe, expect, it } from 'vitest'
import { addUnreceiptedTuition, summarizeCashDay } from '../cash-day'

describe('addUnreceiptedTuition', () => {
  const base = summarizeCashDay({
    issued: [
      { total: 5000, method: 'CASH', meals: [{ service: 'CANTEEN', amount: 3000 }], childcare: [] },
    ],
    cancelled: [],
  }).net

  it('adds tuition payments to the total, the method and the tuition line, not the count', () => {
    const totals = addUnreceiptedTuition(base, [
      { amount: 10000, method: 'CASH' },
      { amount: 4000, method: 'MOBILE_MONEY' },
      { amount: -1000, method: 'CASH' },
    ])

    expect(totals.count).toBe(1)
    expect(totals.total).toBe(18000)
    expect(totals.byMethod).toEqual({ CASH: 14000, MOBILE_MONEY: 4000 })
    expect(totals.byLine).toEqual({ CANTEEN: 3000, SNACK: 0, CHILDCARE: 0, TUITION: 15000 })
  })

  it('leaves the input totals untouched', () => {
    addUnreceiptedTuition(base, [{ amount: 10000, method: 'CASH' }])

    expect(base.total).toBe(5000)
    expect(base.byMethod).toEqual({ CASH: 5000 })
    expect(base.byLine.TUITION).toBe(2000)
  })
})
