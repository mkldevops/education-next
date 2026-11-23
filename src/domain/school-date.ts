/** Returns the school's local calendar date (`YYYY-MM-DD`) at `now`. */
export function schoolToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Écart, en millisecondes, entre l'heure locale de `timeZone` et UTC à l'instant `ms`. */
function zoneOffset(timeZone: string, ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(ms)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const local = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  )
  return local - Math.floor(ms / 1000) * 1000
}

/** Minuit local de `day` (`YYYY-MM-DD`) dans `timeZone`, en instant UTC. */
function localMidnight(day: string, timeZone: string): Date {
  const utc = Date.parse(`${day}T00:00:00.000Z`)
  const guess = utc - zoneOffset(timeZone, utc)
  return new Date(utc - zoneOffset(timeZone, guess))
}

/** Le jour local `day` de l'école, `[start, end[` en instants UTC. */
export function schoolDayBounds(day: string, timeZone: string): { start: Date; end: Date } {
  const next = new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)
  return { start: localMidnight(day, timeZone), end: localMidnight(next, timeZone) }
}

/** First day (`YYYY-MM-DD`) of the month following the given school date. */
export function nextMonthStart(day: string): string {
  const [year, month] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}
