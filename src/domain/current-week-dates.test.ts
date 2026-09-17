import { describe, expect, it } from 'vitest'
import { currentWeekDates, planningWeekday } from './current-week-dates'

describe('currentWeekDates', () => {
  it('maps every planning weekday to its date in the current week', () => {
    expect(currentWeekDates(new Date('2026-09-17T12:00:00.000Z'))).toEqual({
      1: '2026-09-14',
      2: '2026-09-15',
      3: '2026-09-16',
      4: '2026-09-17',
      5: '2026-09-18',
      6: '2026-09-19',
      7: '2026-09-20',
    })
  })

  it('maps Sunday to planning weekday 7', () => {
    expect(planningWeekday(new Date('2026-09-20T00:00:00.000Z'))).toBe(7)
  })
})
