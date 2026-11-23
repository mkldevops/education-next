import { describe, expect, it } from 'vitest'
import { nextMonthStart, schoolDayBounds, schoolToday } from './school-date'

describe('schoolToday', () => {
  it('switches day at local midnight in Indian/Comoro (UTC+3)', () => {
    expect(schoolToday('Indian/Comoro', new Date('2026-10-23T20:59:59.000Z'))).toBe('2026-10-23')
    expect(schoolToday('Indian/Comoro', new Date('2026-10-23T21:00:00.000Z'))).toBe('2026-10-24')
  })

  it('follows daylight saving time in Europe/Paris', () => {
    expect(schoolToday('Europe/Paris', new Date('2026-07-01T21:59:59.000Z'))).toBe('2026-07-01')
    expect(schoolToday('Europe/Paris', new Date('2026-07-01T22:00:00.000Z'))).toBe('2026-07-02')
    expect(schoolToday('Europe/Paris', new Date('2026-12-31T22:59:59.000Z'))).toBe('2026-12-31')
    expect(schoolToday('Europe/Paris', new Date('2026-12-31T23:00:00.000Z'))).toBe('2027-01-01')
  })
})

describe('schoolDayBounds', () => {
  it('spans the local day in Indian/Comoro (UTC+3)', () => {
    expect(schoolDayBounds('2026-10-24', 'Indian/Comoro')).toEqual({
      start: new Date('2026-10-23T21:00:00.000Z'),
      end: new Date('2026-10-24T21:00:00.000Z'),
    })
  })

  it('has 23 hours on the spring-forward day in Europe/Paris', () => {
    expect(schoolDayBounds('2027-03-28', 'Europe/Paris')).toEqual({
      start: new Date('2027-03-27T23:00:00.000Z'),
      end: new Date('2027-03-28T22:00:00.000Z'),
    })
  })
})

describe('nextMonthStart', () => {
  it('returns the first day of the following month, across a year end', () => {
    expect(nextMonthStart('2026-11-10')).toBe('2026-12-01')
    expect(nextMonthStart('2026-12-31')).toBe('2027-01-01')
  })
})
