import { describe, expect, it } from 'vitest'
import {
  overlapsAny,
  planStop,
  previousDay,
  segmentFrom,
  validateSegmentDates,
} from './meal-schedule'

const period = { periodStart: '2026-09-01', periodEnd: '2027-07-03' }

describe('previousDay', () => {
  it('crosses a month boundary', () => {
    expect(previousDay('2026-11-01')).toBe('2026-10-31')
  })
})

describe('validateSegmentDates', () => {
  it('accepts an open segment inside the period', () => {
    expect(validateSegmentDates({ startOn: '2026-10-26', endOn: null, ...period })).toBe('OK')
  })

  it('refuses a start before or after the period', () => {
    expect(validateSegmentDates({ startOn: '2026-08-31', endOn: null, ...period })).toBe(
      'outsidePeriod'
    )
    expect(validateSegmentDates({ startOn: '2027-07-04', endOn: null, ...period })).toBe(
      'outsidePeriod'
    )
  })

  it('refuses an end before the start or past the period', () => {
    expect(validateSegmentDates({ startOn: '2026-10-26', endOn: '2026-10-25', ...period })).toBe(
      'outsidePeriod'
    )
    expect(validateSegmentDates({ startOn: '2026-10-26', endOn: '2027-07-04', ...period })).toBe(
      'outsidePeriod'
    )
  })
})

describe('overlapsAny', () => {
  const closed = { id: 'a', startOn: '2026-09-01', endOn: '2026-10-31' }

  it('sees an open segment overlapping a closed one', () => {
    expect(overlapsAny([closed], { startOn: '2026-10-31', endOn: null })).toBe(true)
  })

  it('lets a segment start the day after another ends', () => {
    expect(overlapsAny([closed], { startOn: '2026-11-01', endOn: null })).toBe(false)
  })

  it('treats an open segment as running to the end', () => {
    const open = { id: 'b', startOn: '2026-11-01', endOn: null }
    expect(overlapsAny([open], { startOn: '2027-03-01', endOn: '2027-03-05' })).toBe(true)
  })
})

describe('segmentFrom', () => {
  const segments = [
    { id: 'past', startOn: '2026-09-01', endOn: '2026-10-31' },
    { id: 'next', startOn: '2026-11-09', endOn: null },
  ]

  it('returns the segment serving the day', () => {
    expect(segmentFrom(segments, '2026-10-15')?.id).toBe('past')
  })

  it('falls back to the next segment to start', () => {
    expect(segmentFrom(segments, '2026-11-02')?.id).toBe('next')
  })

  it('returns null once everything has ended', () => {
    expect(segmentFrom([segments[0]], '2026-11-02')).toBeNull()
  })
})

describe('planStop', () => {
  it('closes a started segment the day before and removes a future one', () => {
    const plan = planStop(
      [
        { id: 'started', startOn: '2026-09-01', endOn: null },
        { id: 'future', startOn: '2026-11-09', endOn: null },
      ],
      '2026-10-26'
    )
    expect(plan).toEqual({
      removed: ['future'],
      closed: [{ id: 'started', endOn: '2026-10-25' }],
    })
  })

  it('removes a segment starting on the stop day itself', () => {
    expect(planStop([{ id: 's', startOn: '2026-10-26', endOn: null }], '2026-10-26')).toEqual({
      removed: ['s'],
      closed: [],
    })
  })

  it('leaves a segment already ended untouched', () => {
    expect(
      planStop([{ id: 'old', startOn: '2026-09-01', endOn: '2026-10-02' }], '2026-10-26')
    ).toEqual({ removed: [], closed: [] })
  })

  it('shortens a closed segment that ends after the stop day', () => {
    expect(
      planStop([{ id: 's', startOn: '2026-09-01', endOn: '2026-12-18' }], '2026-10-26').closed
    ).toEqual([{ id: 's', endOn: '2026-10-25' }])
  })
})
