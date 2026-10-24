import { DAY_MS, utcStartOfDay } from './day'

/** Fermetures et vacances suspendent cantine et goûter (R12). */
const MEAL_CLOSURE_CATEGORIES = ['CLOSURE', 'HOLIDAY'] as const

type ClosureEvent = { status: string; category: string; startAt: Date; endAt?: Date | null }

/** Un événement publié de l'une des `categories` qui chevauche le jour UTC de `day`. */
export function isSchoolClosed(
  events: ClosureEvent[],
  day: Date,
  categories: readonly string[] = MEAL_CLOSURE_CATEGORIES
): boolean {
  const start = utcStartOfDay(day)
  const end = new Date(start.getTime() + DAY_MS)
  return events.some(
    (event) =>
      event.status === 'PUBLISHED' &&
      categories.includes(event.category) &&
      event.startAt < end &&
      (!event.endAt || event.endAt >= start)
  )
}
