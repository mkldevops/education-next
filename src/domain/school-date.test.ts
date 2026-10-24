import { describe, expect, it } from 'vitest'
import { schoolToday } from './school-date'

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
