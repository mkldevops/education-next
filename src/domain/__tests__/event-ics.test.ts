import { describe, expect, it } from 'vitest'
import { buildEventsIcsFeed, EVENT_TIME_ZONE, type IcsEvent, type IcsSchool } from '../event-ics'

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

  it('emits the school wall-clock time with TZID, never a UTC Z, for a summer event', () => {
    // Stocké 18:00 « heure de l'affiche » : en `Z`, Paris (UTC+2 en été) l'affichait à 20:00.
    const event: IcsEvent = {
      ...baseEvent,
      startAt: new Date('2026-09-23T18:00:00.000Z'),
      endAt: new Date('2026-09-23T20:00:00.000Z'),
    }
    const feedLines = unfold(buildEventsIcsFeed(school, [event]))

    expect(feedLines).toContain('DTSTART;TZID=Europe/Paris:20260923T180000')
    expect(feedLines).toContain('DTEND;TZID=Europe/Paris:20260923T200000')
    expect(feedLines.some((line) => /^DT(START|END).*Z$/.test(line))).toBe(false)
  })

  it('emits the same wall-clock digits for a winter event, the VTIMEZONE carrying the offset', () => {
    const event: IcsEvent = {
      ...baseEvent,
      startAt: new Date('2026-12-10T18:00:00.000Z'),
      endAt: new Date('2026-12-10T19:30:00.000Z'),
    }
    const feedLines = unfold(buildEventsIcsFeed(school, [event]))

    expect(feedLines).toContain('DTSTART;TZID=Europe/Paris:20261210T180000')
    expect(feedLines).toContain('DTEND;TZID=Europe/Paris:20261210T193000')
  })

  it('defines the referenced TZID once, before the events, with the EU summer-time rules', () => {
    const feedLines = unfold(
      buildEventsIcsFeed(school, [baseEvent, { ...baseEvent, id: 'event-2' }])
    )

    expect(feedLines.filter((line) => line === 'BEGIN:VTIMEZONE')).toHaveLength(1)
    expect(feedLines.indexOf('BEGIN:VTIMEZONE')).toBeLessThan(feedLines.indexOf('BEGIN:VEVENT'))
    expect(feedLines).toContain(`TZID:${EVENT_TIME_ZONE}`)
    expect(feedLines).toContain('X-WR-TIMEZONE:Europe/Paris')

    const block = feedLines.slice(
      feedLines.indexOf('BEGIN:VTIMEZONE'),
      feedLines.indexOf('END:VTIMEZONE') + 1
    )
    expect(block).toEqual([
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
    ])
  })

  it('matches the VTIMEZONE rules against the runtime tz database (last Sundays of March/October at 01:00 UTC)', () => {
    const offsetMinutes = (instant: Date) => {
      const part = new Intl.DateTimeFormat('en-US', {
        timeZone: EVENT_TIME_ZONE,
        timeZoneName: 'longOffset',
      })
        .formatToParts(instant)
        .find((p) => p.type === 'timeZoneName')?.value
      const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? '')
      if (!match) return 0
      return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    }
    const lastSundayAtOneUtc = (year: number, month: number) => {
      const last = new Date(Date.UTC(year, month + 1, 0, 1))
      return new Date(last.getTime() - last.getUTCDay() * 86_400_000)
    }

    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const toSummer = lastSundayAtOneUtc(year, 2)
      const toWinter = lastSundayAtOneUtc(year, 9)
      expect(offsetMinutes(new Date(toSummer.getTime() - 1))).toBe(60)
      expect(offsetMinutes(toSummer)).toBe(120)
      expect(offsetMinutes(new Date(toWinter.getTime() - 1))).toBe(120)
      expect(offsetMinutes(toWinter)).toBe(60)
    }
  })

  it('omits the VTIMEZONE when no timed event references it', () => {
    const allDay: IcsEvent = {
      ...baseEvent,
      allDay: true,
      startAt: new Date(Date.UTC(2026, 8, 1)),
      endAt: null,
    }

    expect(buildEventsIcsFeed(school, [])).not.toContain('VTIMEZONE')
    expect(buildEventsIcsFeed(school, [allDay])).not.toContain('VTIMEZONE')
  })

  it('keeps DTSTAMP and LAST-MODIFIED as true UTC instants', () => {
    const feedLines = unfold(
      buildEventsIcsFeed(school, [baseEvent], new Date('2026-08-15T07:30:00.000Z'))
    )

    expect(feedLines).toContain('DTSTAMP:20260815T073000Z')
    expect(feedLines).toContain('LAST-MODIFIED:20260801T100000Z')
  })

  it('produces a structurally valid calendar: balanced components, CRLF, lines of at most 75 octets', () => {
    const feed = buildEventsIcsFeed(school, [
      { ...baseEvent, title: 'Réunion très longue '.repeat(8), location: 'Salle; B, 1er étage' },
      {
        ...baseEvent,
        id: 'event-2',
        allDay: true,
        startAt: new Date(Date.UTC(2026, 9, 20)),
        endAt: new Date(Date.UTC(2026, 10, 3)),
      },
      { ...baseEvent, id: 'event-3', endAt: null, status: 'CANCELLED' },
    ])
    const physicalLines = feed.split('\r\n').slice(0, -1)
    const encoder = new TextEncoder()

    for (const line of physicalLines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }

    const stack: string[] = []
    for (const line of unfold(feed)) {
      if (line.startsWith('BEGIN:')) stack.push(line.slice(6))
      if (line.startsWith('END:')) expect(stack.pop()).toBe(line.slice(4))
    }
    expect(stack).toEqual([])

    const events = feed.split('BEGIN:VEVENT').slice(1)
    expect(events).toHaveLength(3)
    for (const block of events) {
      const lines = unfold(block)
      expect(lines.filter((line) => line.startsWith('UID:'))).toHaveLength(1)
      expect(lines.filter((line) => line.startsWith('DTSTAMP:'))).toHaveLength(1)
      expect(lines.filter((line) => line.startsWith('DTSTART'))).toHaveLength(1)
    }

    const tzids = new Set(
      unfold(feed).flatMap((line) => /;TZID=([^:;]+)/.exec(line)?.slice(1) ?? [])
    )
    for (const tzid of tzids) expect(unfold(feed)).toContain(`TZID:${tzid}`)
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
