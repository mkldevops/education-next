import type { EventCategory } from '@/generated/prisma/enums'

/**
 * Ordre de priorité d'un jour partagé : une fermeture se lit avant une sortie ou une réunion.
 * Il fixe aussi l'ordre de la légende.
 */
export const EVENT_CALENDAR_CATEGORIES: readonly EventCategory[] = [
  'HOLIDAY',
  'CLOSURE',
  'TERM_START',
  'MEETING',
  'OUTING',
  'CELEBRATION',
  'OTHER',
]

/** Une année scolaire tient en douze mois : au-delà, la vue d'ensemble deviendrait illisible. */
export const MAX_EVENT_CALENDAR_MONTHS = 12

const DAY_MS = 24 * 60 * 60 * 1000

export type EventCalendarInput = {
  title: string
  category: EventCategory
  startAt: Date
  endAt: Date | null
}

type EventCalendarDay = {
  day: number
  /** Catégories du jour, sans doublon, dans l'ordre de `EVENT_CALENDAR_CATEGORIES`. */
  categories: EventCategory[]
  titles: string[]
}

export type EventCalendarMonth = {
  year: number
  /** 0 = janvier, comme `Date.getUTCMonth`. */
  month: number
  /** Semaines du lundi au dimanche ; `null` hors du mois. */
  weeks: (EventCalendarDay | null)[][]
}

function dayIndex(value: Date): number {
  return Math.floor(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / DAY_MS
  )
}

/**
 * Mois couverts par la vue : la période choisie (`until` exclusif), sinon du premier au dernier
 * événement. Les composants sont lus en UTC, selon la convention « allDay → minuit UTC ».
 */
export function eventCalendarRange(
  events: readonly EventCalendarInput[],
  bounds: { from: Date; until: Date } | null
): { from: Date; until: Date } | null {
  if (bounds) return bounds
  if (events.length === 0) return null
  const first = Math.min(...events.map((event) => dayIndex(event.startAt)))
  const last = Math.max(...events.map((event) => dayIndex(event.endAt ?? event.startAt)))
  return { from: new Date(first * DAY_MS), until: new Date((last + 1) * DAY_MS) }
}

export function buildEventCalendar(
  events: readonly EventCalendarInput[],
  range: { from: Date; until: Date }
): EventCalendarMonth[] {
  const firstDay = dayIndex(range.from)
  const lastDay = dayIndex(range.until) - 1
  if (lastDay < firstDay) return []

  const byDay = new Map<number, EventCalendarInput[]>()
  for (const event of events) {
    const eventStart = dayIndex(event.startAt)
    const start = Math.max(firstDay, eventStart)
    const end = Math.min(lastDay, Math.max(eventStart, dayIndex(event.endAt ?? event.startAt)))
    for (let index = start; index <= end; index++) {
      const list = byDay.get(index)
      if (list) list.push(event)
      else byDay.set(index, [event])
    }
  }

  const last = new Date(lastDay * DAY_MS)

  const months: EventCalendarMonth[] = []
  let year = range.from.getUTCFullYear()
  let month = range.from.getUTCMonth()
  while (
    months.length < MAX_EVENT_CALENDAR_MONTHS &&
    (year < last.getUTCFullYear() ||
      (year === last.getUTCFullYear() && month <= last.getUTCMonth()))
  ) {
    months.push(buildMonth(year, month, byDay))
    month += 1
    if (month === 12) {
      month = 0
      year += 1
    }
  }
  return months
}

function buildMonth(
  year: number,
  month: number,
  byDay: Map<number, EventCalendarInput[]>
): EventCalendarMonth {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const leading = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const cells: (EventCalendarDay | null)[] = Array.from({ length: leading }, () => null)

  for (let day = 1; day <= daysInMonth; day++) {
    const events = byDay.get(dayIndex(new Date(Date.UTC(year, month, day)))) ?? []
    cells.push({
      day,
      categories: EVENT_CALENDAR_CATEGORIES.filter((category) =>
        events.some((event) => event.category === category)
      ),
      titles: events.map((event) => event.title),
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (EventCalendarDay | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  return { year, month, weeks }
}
