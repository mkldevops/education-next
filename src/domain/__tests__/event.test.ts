import { describe, expect, it } from 'vitest'
import {
  normalizeEventDates,
  shiftEventToNextYear,
  slugifyEventTitle,
  validateEventRange,
  visibleEventVisibilities,
} from '../event'

describe('slugifyEventTitle', () => {
  it('lowercases and unfolds accents', () => {
    expect(slugifyEventTitle('Réunion de Rentrée')).toBe('reunion-de-rentree')
  })

  it('collapses punctuation runs into a single hyphen and trims the edges', () => {
    expect(slugifyEventTitle("  Portes ouvertes : l'école fête ses 10 ans !  ")).toBe(
      'portes-ouvertes-l-ecole-fete-ses-10-ans'
    )
  })

  it('truncates to 140 characters', () => {
    const title = 'a'.repeat(200)

    const slug = slugifyEventTitle(title)

    expect(slug).toHaveLength(140)
    expect(slug).toBe('a'.repeat(140))
  })
})

describe('visibleEventVisibilities', () => {
  it('limits a public reader to public events', () => {
    expect(visibleEventVisibilities('PUBLIC')).toEqual(['PUBLIC'])
  })

  it('lets a family member see public and member events', () => {
    expect(visibleEventVisibilities('MEMBER')).toEqual(['PUBLIC', 'MEMBERS'])
  })

  it('lets staff see every visibility', () => {
    expect(visibleEventVisibilities('STAFF')).toEqual(['PUBLIC', 'MEMBERS', 'STAFF'])
  })
})

describe('validateEventRange', () => {
  it('accepts an end date after the start date', () => {
    expect(
      validateEventRange({ startAt: new Date('2026-03-10'), endAt: new Date('2026-03-12') })
    ).toBe('OK')
  })

  it('accepts an event with no end date', () => {
    expect(validateEventRange({ startAt: new Date('2026-03-10') })).toBe('OK')
  })

  it('accepts equal start and end dates', () => {
    const at = new Date('2026-03-10T09:00:00.000Z')
    expect(validateEventRange({ startAt: at, endAt: at })).toBe('OK')
  })

  it('rejects an end date before the start date', () => {
    expect(
      validateEventRange({ startAt: new Date('2026-03-12'), endAt: new Date('2026-03-10') })
    ).toBe('invalidDateRange')
  })
})

describe('normalizeEventDates', () => {
  it('snaps an all-day event to UTC midnight of the same UTC calendar day', () => {
    const result = normalizeEventDates({
      allDay: true,
      startAt: new Date('2026-03-10T22:30:00.000Z'),
      endAt: new Date('2026-03-12T05:00:00.000Z'),
    })

    expect(result.startAt.toISOString()).toBe('2026-03-10T00:00:00.000Z')
    expect(result.endAt?.toISOString()).toBe('2026-03-12T00:00:00.000Z')
  })

  it('leaves a null end date untouched', () => {
    const result = normalizeEventDates({
      allDay: true,
      startAt: new Date('2026-03-10T22:30:00.000Z'),
      endAt: null,
    })

    expect(result.endAt).toBeNull()
  })

  it('leaves a timed event untouched', () => {
    const startAt = new Date('2026-03-10T22:30:00.000Z')
    const endAt = new Date('2026-03-10T23:00:00.000Z')

    const result = normalizeEventDates({ allDay: false, startAt, endAt })

    expect(result.startAt).toBe(startAt)
    expect(result.endAt).toBe(endAt)
  })
})

describe('shiftEventToNextYear', () => {
  it('moves an all-day event to the same day of the following year', () => {
    expect(shiftEventToNextYear({ startAt: new Date('2026-12-03T00:00:00.000Z') })).toEqual({
      startAt: new Date('2027-12-03T00:00:00.000Z'),
      endAt: null,
    })
  })

  it('keeps the wall-clock time of a timed event', () => {
    const { startAt } = shiftEventToNextYear({ startAt: new Date('2026-09-01T18:30:00.000Z') })

    expect(startAt).toEqual(new Date('2027-09-01T18:30:00.000Z'))
  })

  it('preserves the duration between start and end', () => {
    expect(
      shiftEventToNextYear({
        startAt: new Date('2027-02-26T00:00:00.000Z'),
        endAt: new Date('2027-03-02T00:00:00.000Z'),
      })
    ).toEqual({
      startAt: new Date('2028-02-26T00:00:00.000Z'),
      endAt: new Date('2028-03-01T00:00:00.000Z'),
    })
  })

  it('lands a 29 February on the 28th rather than in March', () => {
    const { startAt } = shiftEventToNextYear({ startAt: new Date('2028-02-29T00:00:00.000Z') })

    expect(startAt).toEqual(new Date('2029-02-28T00:00:00.000Z'))
  })
})
