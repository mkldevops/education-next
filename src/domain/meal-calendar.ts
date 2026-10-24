import { nextDay, weekdayOf } from './meal-ledger'

/**
 * État d'un jour prévu : payé, dû (passé non couvert), à payer (futur non couvert),
 * absent ou fermé. Un jour hors des segments n'apparaît pas.
 */
export type MealDayStatus = 'paid' | 'due' | 'unpaid' | 'absent' | 'closed'

type Segment = {
  weekdays: readonly number[]
  startOn: string
  endOn: string | null
  periodEnd: string
}

/**
 * Calendrier d'un compte (écran « fiche repas ») : chaque jour prévu par un segment, avec son
 * état. `served` et `ownedDays` viennent du même calcul que le « payé jusqu'au » : les
 * `ownedDays` premiers jours servis sont payés, comme en R2.
 */
export function mealCalendar(input: {
  segments: readonly Segment[]
  isClosed: (day: string) => boolean
  absences: ReadonlySet<string>
  served: readonly string[]
  ownedDays: number
  today: string
}): Array<{ day: string; status: MealDayStatus }> {
  const covered = new Set(input.served.slice(0, Math.max(0, input.ownedDays)))
  const days = new Map<string, MealDayStatus>()
  for (const segment of input.segments) {
    const last = segment.endOn ?? segment.periodEnd
    for (let day = segment.startOn; day <= last; day = nextDay(day)) {
      if (!segment.weekdays.includes(weekdayOf(day))) continue
      days.set(day, statusOf(day, input, covered))
    }
  }
  return [...days].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, status]) => ({ day, status }))
}

function statusOf(
  day: string,
  input: { isClosed: (day: string) => boolean; absences: ReadonlySet<string>; today: string },
  covered: ReadonlySet<string>
): MealDayStatus {
  if (input.isClosed(day)) return 'closed'
  if (input.absences.has(day)) return 'absent'
  if (covered.has(day)) return 'paid'
  return day <= input.today ? 'due' : 'unpaid'
}
