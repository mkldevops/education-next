import { afterEach, describe, expect, it } from 'vitest'
import {
  calculateAge,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatEventDate,
  formatEventPosterDate,
  parseEventInputValue,
  toEventInputValue,
} from '../date'

const VALUE = '2026-03-09T14:05:00.000Z'

describe('date formatting', () => {
  it('follows the locale for the short form', () => {
    expect(formatDate(VALUE, 'fr-FR')).toBe('09/03/2026')
    expect(formatDate(VALUE, 'en-US')).toBe('3/9/2026')
  })

  it('accepts a Date, a string or a timestamp', () => {
    const expected = formatDate(VALUE, 'fr-FR')

    expect(formatDate(new Date(VALUE), 'fr-FR')).toBe(expected)
    expect(formatDate(Date.parse(VALUE), 'fr-FR')).toBe(expected)
  })

  it('spells the month out in the long form', () => {
    expect(formatDateLong(VALUE, 'fr-FR')).toMatch(/^09 mars 2026$/)
  })

  it('keeps date and time together in the timestamp form', () => {
    expect(formatDateTime(VALUE, 'fr-FR')).toContain('2026')
    expect(formatDateTime(VALUE, 'fr-FR')).toMatch(/\d{2}:\d{2}/)
  })
})

describe('event input value round-trip', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })

  it('reads the same UTC quantième back regardless of the reader timezone', () => {
    process.env.TZ = 'America/Los_Angeles'
    const stored = new Date('2026-03-10T00:00:00.000Z')

    expect(toEventInputValue(stored, true)).toBe('2026-03-10')
    expect(parseEventInputValue(toEventInputValue(stored, true))).toEqual(stored)
  })

  it('does not shift the day when the same instant is reformatted for the other input type', () => {
    process.env.TZ = 'Pacific/Honolulu'
    const stored = new Date('2026-03-10T00:00:00.000Z')

    const asAllDay = toEventInputValue(stored, true)
    const asTimed = toEventInputValue(stored, false)

    expect(asAllDay).toBe('2026-03-10')
    expect(asTimed).toBe('2026-03-10T00:00')
  })

  it('round-trips a timed value through the same UTC hour', () => {
    process.env.TZ = 'America/Los_Angeles'
    const stored = new Date('2026-12-03T17:30:00.000Z')

    const value = toEventInputValue(stored, false)
    expect(value).toBe('2026-12-03T17:30')
    expect(parseEventInputValue(value)).toEqual(stored)
  })
})

describe('calculateAge', () => {
  it('counts only birthdays already passed', () => {
    expect(calculateAge('2016-01-12', '2026-01-12')).toBe(10)
    expect(calculateAge('2016-01-12', '2026-01-11')).toBe(9)
  })

  it('ignores the year difference when the month is still ahead', () => {
    expect(calculateAge('2016-12-31', '2026-01-01')).toBe(9)
  })

  it('handles a birthday on 29 February', () => {
    expect(calculateAge('2016-02-29', '2026-02-28')).toBe(9)
    expect(calculateAge('2016-02-29', '2026-03-01')).toBe(10)
  })
})

describe('formatEventDate', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })

  it('keeps an all-day event on its stored UTC day for a reader west of Greenwich', () => {
    process.env.TZ = 'America/Los_Angeles'

    const label = formatEventDate(
      { allDay: true, startAt: new Date(Date.UTC(2026, 2, 10)), endAt: null },
      'en-US'
    )

    expect(label).toBe('Mar 10, 2026')
  })

  it('shows an all-day range spanning midnight UTC without shifting either bound', () => {
    process.env.TZ = 'Pacific/Honolulu'

    const label = formatEventDate(
      {
        allDay: true,
        startAt: new Date(Date.UTC(2026, 2, 10)),
        endAt: new Date(Date.UTC(2026, 2, 12)),
      },
      'fr-FR'
    )

    expect(label).toBe('10 mars 2026 – 12 mars 2026')
  })

  it('shows a single-day all-day event once, not as a repeated range', () => {
    process.env.TZ = 'UTC'

    const label = formatEventDate(
      {
        allDay: true,
        startAt: new Date(Date.UTC(2026, 2, 10)),
        endAt: new Date(Date.UTC(2026, 2, 10)),
      },
      'fr-FR'
    )

    expect(label).toBe('10 mars 2026')
  })

  it('keeps a timed event on its stored UTC hour for a reader west of Greenwich', () => {
    process.env.TZ = 'America/Los_Angeles'

    const label = formatEventDate(
      {
        allDay: false,
        startAt: new Date('2026-03-10T09:00:00.000Z'),
        endAt: new Date('2026-03-10T10:30:00.000Z'),
      },
      'fr-FR'
    )

    expect(label).toContain('10 mars 2026')
    expect(label).toMatch(/09:00.*10:30/)
  })

  it('shows the date once and only the end time for a same-day timed event', () => {
    process.env.TZ = 'Pacific/Honolulu'

    const label = formatEventDate(
      {
        allDay: false,
        startAt: new Date('2026-03-10T09:00:00.000Z'),
        endAt: new Date('2026-03-10T10:30:00.000Z'),
      },
      'fr-FR'
    )

    expect(label.match(/mars 2026/g)).toHaveLength(1)
    expect(label).toMatch(/09:00.*10:30/)
  })

  it('repeats the full date and time for a timed event spanning several days', () => {
    process.env.TZ = 'Pacific/Honolulu'

    const label = formatEventDate(
      {
        allDay: false,
        startAt: new Date('2026-03-10T09:00:00.000Z'),
        endAt: new Date('2026-03-12T10:30:00.000Z'),
      },
      'fr-FR'
    )

    expect(label.match(/mars 2026/g)).toHaveLength(2)
    expect(label).toMatch(/10 mars 2026.*09:00.*12 mars 2026.*10:30/)
  })
})

describe('formatEventPosterDate', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  })

  it('spells out weekday and month of an all-day event on its stored UTC day', () => {
    process.env.TZ = 'America/Los_Angeles'

    const label = formatEventPosterDate(
      { allDay: true, startAt: new Date(Date.UTC(2026, 11, 3)), endAt: null },
      'fr-FR'
    )

    expect(label).toBe('jeudi 3 décembre 2026')
  })

  it('adds the wall-clock hours of a timed event on a single day', () => {
    process.env.TZ = 'Europe/Paris'

    const label = formatEventPosterDate(
      {
        allDay: false,
        startAt: new Date('2026-12-03T18:00:00.000Z'),
        endAt: new Date('2026-12-03T20:30:00.000Z'),
      },
      'fr-FR'
    )

    expect(label).toBe('jeudi 3 décembre 2026, 18:00 – 20:30')
  })

  it('names both days of a multi-day all-day event', () => {
    const label = formatEventPosterDate(
      {
        allDay: true,
        startAt: new Date(Date.UTC(2026, 11, 3)),
        endAt: new Date(Date.UTC(2026, 11, 5)),
      },
      'fr-FR'
    )

    expect(label).toBe('jeudi 3 décembre 2026 – samedi 5 décembre 2026')
  })
})
