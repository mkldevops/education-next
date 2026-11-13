import { describe, expect, it } from 'vitest'
import { buildEventCalendar, eventCalendarRange, MAX_EVENT_CALENDAR_MONTHS } from './event-calendar'

const utc = (value: string) => new Date(`${value}T00:00:00.000Z`)

function dayOf(months: ReturnType<typeof buildEventCalendar>, monthIndex: number, day: number) {
  return months[monthIndex]?.weeks.flat().find((cell) => cell?.day === day)
}

describe('buildEventCalendar', () => {
  const range = { from: utc('2026-09-01'), until: utc('2026-12-01') }

  it('lays out months Monday first, padded to full weeks', () => {
    const months = buildEventCalendar([], range)
    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 8],
      [2026, 9],
      [2026, 10],
    ])
    expect(months[0]?.weeks[0]?.slice(0, 2)).toEqual([null, { day: 1, categories: [], titles: [] }])
    expect(months.every((m) => m.weeks.every((week) => week.length === 7))).toBe(true)
  })

  it('colours every day of a multi-day event, inclusive of its end', () => {
    const months = buildEventCalendar(
      [
        {
          title: 'Vacances',
          category: 'HOLIDAY',
          startAt: utc('2026-10-31'),
          endAt: utc('2026-11-02'),
        },
      ],
      range
    )
    expect(dayOf(months, 1, 30)?.categories).toEqual([])
    expect(dayOf(months, 1, 31)?.categories).toEqual(['HOLIDAY'])
    expect(dayOf(months, 2, 2)?.titles).toEqual(['Vacances'])
    expect(dayOf(months, 2, 3)?.categories).toEqual([])
  })

  it('ranks a closure before an outing on a shared day', () => {
    const months = buildEventCalendar(
      [
        { title: 'Sortie', category: 'OUTING', startAt: utc('2026-09-10'), endAt: null },
        {
          title: 'Férié',
          category: 'CLOSURE',
          startAt: new Date('2026-09-10T08:00:00Z'),
          endAt: null,
        },
      ],
      range
    )
    expect(dayOf(months, 0, 10)?.categories).toEqual(['CLOSURE', 'OUTING'])
  })

  it('leaves the days outside the range uncoloured', () => {
    const months = buildEventCalendar(
      [
        {
          title: 'Stage',
          category: 'OUTING',
          startAt: utc('2026-09-01'),
          endAt: utc('2026-10-31'),
        },
      ],
      { from: utc('2026-09-15'), until: utc('2026-10-16') }
    )
    expect(dayOf(months, 0, 14)?.categories).toEqual([])
    expect(dayOf(months, 0, 15)?.categories).toEqual(['OUTING'])
    expect(dayOf(months, 1, 15)?.categories).toEqual(['OUTING'])
    expect(dayOf(months, 1, 16)?.categories).toEqual([])
  })

  it('caps the view at twelve months', () => {
    const months = buildEventCalendar([], { from: utc('2026-01-01'), until: utc('2028-01-01') })
    expect(months).toHaveLength(MAX_EVENT_CALENDAR_MONTHS)
  })
})

describe('eventCalendarRange', () => {
  it('prefers the selected period', () => {
    const bounds = { from: utc('2026-09-01'), until: utc('2027-07-01') }
    expect(eventCalendarRange([], bounds)).toBe(bounds)
  })

  it('falls back to the span of the events, or nothing', () => {
    expect(eventCalendarRange([], null)).toBeNull()
    expect(
      eventCalendarRange(
        [
          { title: 'A', category: 'OTHER', startAt: utc('2026-11-05'), endAt: utc('2026-11-08') },
          { title: 'B', category: 'OTHER', startAt: utc('2026-10-02'), endAt: null },
        ],
        null
      )
    ).toEqual({ from: utc('2026-10-02'), until: utc('2026-11-09') })
  })
})
