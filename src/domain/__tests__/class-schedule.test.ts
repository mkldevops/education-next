import { describe, expect, it } from 'vitest'
import { validateWeeklyTimeRange, weeklyTimeRangesOverlap } from '../class-schedule'

describe('validateWeeklyTimeRange', () => {
  it('accepts a weekday slot with a strictly increasing wall-clock range', () => {
    expect(validateWeeklyTimeRange({ weekday: 1, startTime: '08:30', endTime: '09:15' })).toBe('OK')
  })

  it('rejects invalid weekdays, times and empty ranges', () => {
    expect(validateWeeklyTimeRange({ weekday: 0, startTime: '08:30', endTime: '09:15' })).toBe(
      'invalidTimeRange'
    )
    expect(validateWeeklyTimeRange({ weekday: 2, startTime: '8:30', endTime: '09:15' })).toBe(
      'invalidTimeRange'
    )
    expect(validateWeeklyTimeRange({ weekday: 2, startTime: '09:15', endTime: '09:15' })).toBe(
      'invalidTimeRange'
    )
  })
})

describe('weeklyTimeRangesOverlap', () => {
  const slot = { weekday: 3, startTime: '09:00', endTime: '10:00' }

  it('does not treat adjacent ranges or a different weekday as overlaps', () => {
    expect(
      weeklyTimeRangesOverlap(slot, { weekday: 3, startTime: '10:00', endTime: '11:00' })
    ).toBe(false)
    expect(
      weeklyTimeRangesOverlap(slot, { weekday: 4, startTime: '09:30', endTime: '10:30' })
    ).toBe(false)
  })

  it('detects an intersecting range', () => {
    expect(
      weeklyTimeRangesOverlap(slot, { weekday: 3, startTime: '09:30', endTime: '10:30' })
    ).toBe(true)
  })
})
