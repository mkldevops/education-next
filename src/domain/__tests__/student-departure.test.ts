import { describe, expect, it } from 'vitest'
import {
  defaultDepartureMonth,
  departureMonths,
  departureSettlement,
} from '@/domain/student-departure'

const period = {
  startAt: new Date('2026-09-01T00:00:00.000Z'),
  endAt: new Date('2027-06-30T00:00:00.000Z'),
}

describe('departureMonths', () => {
  it('spans the open enrollment periods, across the new year', () => {
    const months = departureMonths([period], '2026-11')
    expect(months[0]).toBe('2026-09')
    expect(months).toContain('2027-01')
    expect(months.at(-1)).toBe('2027-06')
    expect(months).toHaveLength(10)
  })

  it('offers the current month only without any period', () => {
    expect(departureMonths([], '2026-11')).toEqual(['2026-11'])
  })
})

describe('defaultDepartureMonth', () => {
  const months = departureMonths([period], '2026-11')

  it('is the current school month, brought back inside the period', () => {
    expect(defaultDepartureMonth(months, '2026-11')).toBe('2026-11')
    expect(defaultDepartureMonth(months, '2026-07')).toBe('2026-09')
    expect(defaultDepartureMonth(months, '2027-08')).toBe('2027-06')
  })
})

describe('departureSettlement', () => {
  it('keeps the remainder owed', () => {
    expect(departureSettlement(400, 150, 'keep')).toEqual({
      totalAmount: 400,
      writeOffAmount: null,
    })
  })

  it('writes the remainder off down to what was paid', () => {
    expect(departureSettlement(400, 150, 'writeOff')).toEqual({
      totalAmount: 150,
      writeOffAmount: 250,
    })
  })

  it('never turns a payment beyond the amount owed into a credit', () => {
    expect(departureSettlement(400, 500, 'keep').totalAmount).toBe(500)
    expect(departureSettlement(400, 500, 'writeOff')).toEqual({
      totalAmount: 500,
      writeOffAmount: 0,
    })
  })
})
