import { describe, expect, it } from 'vitest'
import { expectedAttendance } from './attendance-tracking'

describe('expectedAttendance', () => {
  it('excludes a cancelled slot occurrence', () => {
    const date = new Date('2026-01-05T00:00:00.000Z')
    expect(
      expectedAttendance(
        date,
        [{ id: 'a', classPeriodId: 'class-a', weekday: 1 }],
        [{ classPeriodId: 'class-a', occurrenceKey: 'a', status: 'CANCELLED' }]
      )
    ).toEqual([])
  })
  it('returns no missing call without a matching slot and honors exclusions', () => {
    const date = new Date('2026-09-16T00:00:00Z')
    expect(
      expectedAttendance(date, [{ id: 'a', classPeriodId: 'class-a', weekday: 1 }], [])
    ).toEqual([])
    expect(
      expectedAttendance(
        date,
        [{ id: 'a', classPeriodId: 'class-a', weekday: 3 }],
        [],
        new Set(['a'])
      )
    ).toEqual([])
  })
  it('derives not started, in progress and validated from slot occurrences', () => {
    const date = new Date('2026-09-16T00:00:00Z')
    const slots = [
      { id: 'a', classPeriodId: 'a', weekday: 3 },
      { id: 'b', classPeriodId: 'b', weekday: 3 },
      { id: 'c', classPeriodId: 'c', weekday: 3 },
    ]
    expect(
      expectedAttendance(date, slots, [
        { classPeriodId: 'b', occurrenceKey: 'b', status: 'DRAFT' },
        { classPeriodId: 'c', occurrenceKey: 'c', status: 'VALIDATED' },
      ]).map((x) => x.status)
    ).toEqual(['NOT_STARTED', 'IN_PROGRESS', 'VALIDATED'])
  })
  it('matches Sunday with the planning convention weekday 7', () => {
    const date = new Date('2026-09-20T00:00:00.000Z')
    expect(
      expectedAttendance(date, [{ id: 'sunday', classPeriodId: 'a', weekday: 7 }], [])
    ).toHaveLength(1)
  })
})
