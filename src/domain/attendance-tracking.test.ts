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
  it('includes a Sunday slot using planning weekday 7', () => {
    const date = new Date('2026-09-20T00:00:00Z')

    expect(
      expectedAttendance(date, [{ id: 'sunday', classPeriodId: 'class-a', weekday: 7 }], [])
    ).toEqual([
      {
        classPeriodId: 'class-a',
        classScheduleSlotId: 'sunday',
        occurrenceKey: 'sunday',
        occurredOn: date,
        status: 'NOT_STARTED',
      },
    ])
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

describe('daily expectedAttendance', () => {
  const date = new Date('2026-09-16T00:00:00Z')
  const slots = [
    { id: 'afternoon', classPeriodId: 'a', weekday: 3, startTime: '14:00' },
    { id: 'morning', classPeriodId: 'a', weekday: 3, startTime: '08:00' },
    { id: 'other', classPeriodId: 'b', weekday: 3, startTime: '09:00' },
  ]

  it('collapses lessons per class and uses the earliest lesson as a link representative', () => {
    expect(expectedAttendance(date, slots, [], new Set(), 'DAILY')).toEqual([
      {
        classPeriodId: 'a',
        classScheduleSlotId: 'morning',
        occurrenceKey: 'daily',
        occurredOn: date,
        status: 'NOT_STARTED',
      },
      {
        classPeriodId: 'b',
        classScheduleSlotId: 'other',
        occurrenceKey: 'daily',
        occurredOn: date,
        status: 'NOT_STARTED',
      },
    ])
  })

  it('matches only the canonical daily session and preserves historical lesson identities', () => {
    const sessions = [
      { classPeriodId: 'a', occurrenceKey: 'morning', status: 'VALIDATED' as const },
      { classPeriodId: 'b', occurrenceKey: 'daily', status: 'DRAFT' as const },
    ]
    expect(
      expectedAttendance(date, slots, sessions, new Set(), 'DAILY').map((x) => x.status)
    ).toEqual(['NOT_STARTED', 'IN_PROGRESS'])
    expect(sessions[0].occurrenceKey).toBe('morning')
  })

  it('removes the whole daily occurrence when cancelled and respects exclusions before collapsing', () => {
    expect(
      expectedAttendance(
        date,
        slots,
        [{ classPeriodId: 'a', occurrenceKey: 'daily', status: 'CANCELLED' }],
        new Set(['other']),
        'DAILY'
      )
    ).toEqual([])
    expect(
      expectedAttendance(date, slots, [], new Set(['morning']), 'DAILY')[0]?.classScheduleSlotId
    ).toBe('afternoon')
  })
})
