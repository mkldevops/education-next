import { describe, expect, it } from 'vitest'
import { summarizeCashDay } from './cash-day'

const mixed = {
  total: 8000,
  method: 'CASH',
  meals: [
    { service: 'CANTEEN' as const, amount: 2500 },
    { service: 'SNACK' as const, amount: 500 },
  ],
  childcare: [],
}
const tuition = { total: 15000, method: 'MOBILE_MONEY', meals: [], childcare: [] }

describe('summarizeCashDay', () => {
  it('splits issued receipts by method and by line, tuition being the rest', () => {
    const { issued, net } = summarizeCashDay({ issued: [mixed, tuition], cancelled: [] })

    expect(issued).toEqual({
      count: 2,
      total: 23000,
      byMethod: { CASH: 8000, MOBILE_MONEY: 15000 },
      byLine: { CANTEEN: 2500, SNACK: 500, CHILDCARE: 0, TUITION: 20000 },
    })
    expect(net).toEqual(issued)
  })

  it('takes cancellations made that day off the net, whatever day they were issued', () => {
    const { cancelled, net } = summarizeCashDay({ issued: [tuition], cancelled: [mixed] })

    expect(cancelled.total).toBe(8000)
    expect(net).toEqual({
      count: 0,
      total: 7000,
      byMethod: { CASH: -8000, MOBILE_MONEY: 15000 },
      byLine: { CANTEEN: -2500, SNACK: -500, CHILDCARE: 0, TUITION: 10000 },
    })
  })
})

describe('summarizeCashDay childcare', () => {
  it('books childcare on its own line, outside tuition', () => {
    const receipt = {
      total: 16000,
      method: 'CASH',
      meals: [],
      childcare: [{ amount: 6000 }],
    }

    const { net } = summarizeCashDay({ issued: [receipt], cancelled: [] })

    expect(net.byLine).toEqual({ CANTEEN: 0, SNACK: 0, CHILDCARE: 6000, TUITION: 10000 })
  })
})
