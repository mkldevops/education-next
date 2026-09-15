import { describe, expect, it } from 'vitest'
import { buildEventsIcsFeed, type IcsEvent, type IcsSchool } from '../event-ics'

const school: IcsSchool = { slug: 'ecole-du-parc', name: 'École du Parc' }

const baseEvent: IcsEvent = {
  id: 'event-1',
  title: 'Réunion de rentrée',
  summary: null,
  description: null,
  location: null,
  status: 'PUBLISHED',
  allDay: false,
  startAt: new Date('2026-09-01T18:00:00.000Z'),
  endAt: new Date('2026-09-01T20:00:00.000Z'),
  updatedAt: new Date('2026-08-01T10:00:00.000Z'),
}

/** Recolle une ligne pliée (RFC 5545 §3.1) avec la précédente avant de chercher une propriété. */
function unfold(feed: string): string[] {
  return feed.split('\r\n').reduce<string[]>((acc, line) => {
    if (line.startsWith(' ') && acc.length > 0) {
      acc[acc.length - 1] += line.slice(1)
    } else {
      acc.push(line)
    }
    return acc
  }, [])
}

describe('buildEventsIcsFeed', () => {
  it('wraps events in a VCALENDAR with the required header properties', () => {
    const feed = buildEventsIcsFeed(school, [baseEvent], new Date('2026-08-15T00:00:00.000Z'))
    const feedLines = feed.split('\r\n')

    expect(feedLines[0]).toBe('BEGIN:VCALENDAR')
    expect(feedLines).toContain('VERSION:2.0')
    expect(feedLines).toContain('X-WR-CALNAME:École du Parc')
    expect(feedLines.at(-2)).toBe('END:VCALENDAR')
    expect(feed.endsWith('\r\n')).toBe(true)
  })

  it('produces a valid empty calendar when there are no events', () => {
    const feed = buildEventsIcsFeed(school, [])

    expect(feed).toContain('BEGIN:VCALENDAR')
    expect(feed).toContain('END:VCALENDAR')
    expect(feed).not.toContain('BEGIN:VEVENT')
  })

  it('uses CRLF line endings throughout, never a bare LF', () => {
    const feed = buildEventsIcsFeed(school, [baseEvent])

    expect(feed).toContain('\r\n')
    expect(feed.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('emits a stable UID from the event id and school slug', () => {
    const feed = buildEventsIcsFeed(school, [baseEvent])
    expect(unfold(feed)).toContain('UID:event-1@ecole-du-parc')
  })

  it('emits UTC instants with a trailing Z for a timed event', () => {
    const feedLines = unfold(buildEventsIcsFeed(school, [baseEvent]))

    expect(feedLines).toContain('DTSTART:20260901T180000Z')
    expect(feedLines).toContain('DTEND:20260901T200000Z')
  })

  it('omits DTEND for a timed event with no end instead of inventing a duration', () => {
    const feed = buildEventsIcsFeed(school, [{ ...baseEvent, endAt: null }])
    expect(feed).not.toContain('DTEND')
  })

  it('emits a DATE value, not an instant, for a single all-day event, with no DTEND', () => {
    const event: IcsEvent = {
      ...baseEvent,
      allDay: true,
      startAt: new Date(Date.UTC(2026, 8, 1)),
      endAt: null,
    }
    const feed = buildEventsIcsFeed(school, [event])

    expect(unfold(feed)).toContain('DTSTART;VALUE=DATE:20260901')
    expect(feed).not.toContain('DTEND')
  })

  it('lands a multi-day all-day event on the correct last day (exclusive DTEND = stored endAt + 1 day)', () => {
    // Convention du modèle : `endAt` stocke le DERNIER jour INCLUS (ex. vacances du 20
    // octobre au 3 novembre, `endAt` = le 3). RFC 5545 veut un DTEND EXCLUSIF en
    // VALUE=DATE : le 4, sous peine que le dernier jour de l'événement manque au calendrier.
    const event: IcsEvent = {
      ...baseEvent,
      allDay: true,
      startAt: new Date(Date.UTC(2026, 9, 20)),
      endAt: new Date(Date.UTC(2026, 10, 3)),
    }
    const feedLines = unfold(buildEventsIcsFeed(school, [event]))

    expect(feedLines).toContain('DTSTART;VALUE=DATE:20261020')
    expect(feedLines).toContain('DTEND;VALUE=DATE:20261104')
  })

  it('derives an increasing SEQUENCE from updatedAt while keeping the UID stable across an edit', () => {
    const original = unfold(buildEventsIcsFeed(school, [baseEvent]))
    const edited = unfold(
      buildEventsIcsFeed(school, [
        {
          ...baseEvent,
          title: 'Réunion de rentrée (salle changée)',
          updatedAt: new Date('2026-08-02T09:00:00Z'),
        },
      ])
    )

    expect(edited.find((line) => line.startsWith('UID:'))).toBe(
      original.find((line) => line.startsWith('UID:'))
    )

    const originalSequence = Number(
      original.find((line) => line.startsWith('SEQUENCE:'))?.split(':')[1]
    )
    const editedSequence = Number(
      edited.find((line) => line.startsWith('SEQUENCE:'))?.split(':')[1]
    )
    expect(editedSequence).toBeGreaterThan(originalSequence)
  })

  it('emits STATUS:CANCELLED for a cancelled event instead of removing it from the feed', () => {
    const feedLines = unfold(buildEventsIcsFeed(school, [{ ...baseEvent, status: 'CANCELLED' }]))

    expect(feedLines).toContain('STATUS:CANCELLED')
    expect(feedLines).toContain('UID:event-1@ecole-du-parc')
  })

  it('emits STATUS:CONFIRMED for a published event', () => {
    expect(unfold(buildEventsIcsFeed(school, [baseEvent]))).toContain('STATUS:CONFIRMED')
  })

  it('escapes commas, semicolons, backslashes and newlines in text properties', () => {
    const event: IcsEvent = {
      ...baseEvent,
      title: 'Kermesse; portes ouvertes, 16h\\17h',
      description: 'Ligne un\nLigne deux',
    }
    const feedLines = unfold(buildEventsIcsFeed(school, [event]))

    expect(feedLines).toContain('SUMMARY:Kermesse\\; portes ouvertes\\, 16h\\\\17h')
    expect(feedLines).toContain('DESCRIPTION:Ligne un\\nLigne deux')
  })

  it('falls the description back to the summary when no long description was entered', () => {
    const event: IcsEvent = { ...baseEvent, summary: 'Résumé court', description: null }
    expect(unfold(buildEventsIcsFeed(school, [event]))).toContain('DESCRIPTION:Résumé court')
  })

  it('folds a property line longer than 75 octets and reconstructs it correctly when unfolded', () => {
    const longTitle = 'Réunion '.repeat(20).trim()
    const feed = buildEventsIcsFeed(school, [{ ...baseEvent, title: longTitle }])

    // La ligne SUMMARY brute dépasse 75 octets : elle ne doit jamais apparaître telle
    // quelle sur une seule ligne physique.
    expect(feed).not.toContain(`SUMMARY:${longTitle}\r\n`)
    expect(feed).toMatch(/SUMMARY:[\s\S]*?\r\n /)

    expect(unfold(feed).find((line) => line.startsWith('SUMMARY:'))).toBe(`SUMMARY:${longTitle}`)
  })

  it('never splits a multi-byte UTF-8 character across a fold boundary', () => {
    const longTitle = 'École é è à ç û î ô ê â '.repeat(6).trim()
    const feed = buildEventsIcsFeed(school, [{ ...baseEvent, title: longTitle }])

    expect(unfold(feed).find((line) => line.startsWith('SUMMARY:'))).toBe(`SUMMARY:${longTitle}`)
  })
})
