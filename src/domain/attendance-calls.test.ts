import { describe, expect, it } from 'vitest'
import { attendanceCallPlan, classCallState, compareClassCallState } from './attendance-calls'

const day = (value: string) => new Date(`${value}T00:00:00.000Z`)

const wednesday = { id: 'slot-wed', classPeriodId: 'ce1', weekday: 3, startTime: '13:30' }
const thursday = { id: 'slot-thu', classPeriodId: 'ce1', weekday: 4, startTime: '09:00' }

const base = {
  from: day('2026-11-01'),
  to: day('2026-11-19'),
  today: new Date('2026-11-19T15:42:00.000Z'),
  slots: [wednesday, thursday],
  sessions: [],
  closures: [],
  frequency: 'PER_SLOT' as const,
  trackedSince: new Map([['ce1', day('2026-11-01')]]),
}

describe('attendanceCallPlan', () => {
  it('lists past planned calls as missed and today as to do', () => {
    const { planned, summaries } = attendanceCallPlan({
      ...base,
      sessions: [
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-04'),
          occurrenceKey: 'slot-wed',
          status: 'VALIDATED',
        },
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-05'),
          occurrenceKey: 'slot-thu',
          status: 'VALIDATED',
        },
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-11'),
          occurrenceKey: 'slot-wed',
          status: 'CANCELLED',
        },
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-12'),
          occurrenceKey: 'slot-thu',
          status: 'DRAFT',
        },
      ],
    })
    expect(planned.map((call) => [call.occurredOn.toISOString().slice(0, 10), call.state])).toEqual(
      [
        ['2026-11-18', 'missed'],
        ['2026-11-19', 'todo'],
      ]
    )
    expect(summaries.get('ce1')).toEqual({
      late: 2,
      todayExpected: 1,
      todayDone: 0,
      todayPending: 1,
    })
  })

  it('counts no missed call before the class first used attendance', () => {
    const { planned, summaries } = attendanceCallPlan({
      ...base,
      trackedSince: new Map([['ce1', day('2026-11-18')]]),
    })
    expect(planned.map((call) => call.occurredOn.toISOString().slice(0, 10))).toEqual([
      '2026-11-18',
      '2026-11-19',
    ])
    expect(summaries.get('ce1')?.late).toBe(1)
    expect(attendanceCallPlan({ ...base, trackedSince: new Map() }).planned).toHaveLength(1)
  })

  it('expects nothing on a closure day and nothing after today', () => {
    const { planned } = attendanceCallPlan({
      ...base,
      to: day('2026-11-30'),
      closures: [
        {
          status: 'PUBLISHED',
          category: 'CLOSURE',
          startAt: day('2026-11-01'),
          endAt: day('2026-11-15'),
        },
      ],
    })
    expect(planned.map((call) => call.occurredOn.toISOString().slice(0, 10))).toEqual([
      '2026-11-18',
      '2026-11-19',
    ])
  })

  it('expects one daily call per class on a day with two lessons', () => {
    const { planned } = attendanceCallPlan({
      ...base,
      from: day('2026-11-19'),
      frequency: 'DAILY',
      slots: [thursday, { ...thursday, id: 'slot-thu-pm', startTime: '14:00' }],
    })
    expect(planned).toEqual([
      {
        classPeriodId: 'ce1',
        classScheduleSlotId: 'slot-thu',
        occurrenceKey: 'daily',
        occurredOn: day('2026-11-19'),
        startTime: '09:00',
        state: 'todo',
      },
    ])
  })

  it('lets a whole-day call cover every lesson of that day', () => {
    const { planned, summaries } = attendanceCallPlan({
      ...base,
      from: day('2026-11-18'),
      slots: [wednesday, { ...wednesday, id: 'slot-wed-pm', startTime: '15:00' }, thursday],
      sessions: [
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-18'),
          occurrenceKey: 'daily',
          status: 'VALIDATED',
        },
      ],
    })
    expect(planned.map((call) => call.occurredOn.toISOString().slice(0, 10))).toEqual([
      '2026-11-19',
    ])
    expect(summaries.get('ce1')?.late).toBe(0)
  })

  it('expects nothing on a day whose whole-day call was cancelled', () => {
    const { planned } = attendanceCallPlan({
      ...base,
      from: day('2026-11-18'),
      to: day('2026-11-18'),
      sessions: [
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-18'),
          occurrenceKey: 'daily',
          status: 'CANCELLED',
        },
      ],
    })
    expect(planned).toEqual([])
  })

  it('accepts a lesson call as the day call of a daily school', () => {
    const { planned } = attendanceCallPlan({
      ...base,
      from: day('2026-11-18'),
      to: day('2026-11-18'),
      frequency: 'DAILY',
      sessions: [
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-18'),
          occurrenceKey: 'slot-wed',
          status: 'VALIDATED',
        },
      ],
    })
    expect(planned).toEqual([])
  })

  it('reports a class done once today is validated', () => {
    const { summaries } = attendanceCallPlan({
      ...base,
      from: day('2026-11-19'),
      sessions: [
        {
          classPeriodId: 'ce1',
          occurredOn: day('2026-11-19'),
          occurrenceKey: 'slot-thu',
          status: 'VALIDATED',
        },
      ],
    })
    expect(classCallState(summaries.get('ce1'))).toBe('done')
    expect(classCallState(undefined)).toBe('none')
  })
})

describe('compareClassCallState', () => {
  it('puts late classes first, then to do, then by name', () => {
    const items = [
      { name: 'CM1', state: 'done' as const },
      { name: 'CE2', state: 'todo' as const },
      { name: 'CP', state: 'late' as const },
      { name: 'CE1', state: 'todo' as const },
    ]
    expect(items.sort(compareClassCallState).map((item) => item.name)).toEqual([
      'CP',
      'CE1',
      'CE2',
      'CM1',
    ])
  })
})
