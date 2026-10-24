import { type MealDayStatus, mealCalendar } from './meal-calendar'
import {
  computeCoverage,
  type MealCoverage,
  type MealLedger,
  replayLedger,
  servedDays,
} from './meal-ledger'
import { type MealPriceEntry, priceOn } from './meal-price'
import { segmentFrom } from './meal-schedule'

type Segment = {
  id: string
  periodId: string
  weekdays: number[]
  startOn: string
  endOn: string | null
  periodEnd: string
}

export type MealAccountSummary = {
  current: Segment | null
  coverage: MealCoverage
  opening: { days: number; reason: string } | null
  unitPrice: number | null
  served: string[]
  ledger: MealLedger
  calendar: Array<{ day: string; status: MealDayStatus }>
}

/**
 * Fiche d'un compte : segment en cours ou à venir, et couverture au tarif du jour.
 *
 * `payments` arrive dans l'ordre d'écriture, reçus annulés exclus : le reste d'un
 * encaissement s'ajoute au suivant, à son propre tarif. Un ajustement ne touche que les
 * jours, jamais le reste : sa place parmi les encaissements ne change rien.
 */
export function summarizeMealAccount(input: {
  segments: readonly Segment[]
  adjustments: ReadonlyArray<{ kind: string; days: number; reason: string }>
  payments: ReadonlyArray<{ amount: number; unitPrice: number }>
  prices: readonly MealPriceEntry[]
  isClosed: (day: string) => boolean
  absences?: readonly string[]
  today: string
}): MealAccountSummary {
  const { segments, adjustments, today } = input
  const absences = new Set(input.absences)
  const served = servedDays({
    segments: segments.map((segment) => ({
      ...segment,
      endOn: segment.endOn ?? segment.periodEnd,
    })),
    periodEnd: segments.reduce(
      (last, segment) => (segment.periodEnd > last ? segment.periodEnd : last),
      ''
    ),
    isClosed: input.isClosed,
    absences,
  })
  const unitPrice = priceOn(input.prices, today)
  const opening = adjustments.find((adjustment) => adjustment.kind === 'OPENING')
  const ledger = replayLedger([
    ...adjustments.map(({ days }) => ({ kind: 'adjustment' as const, days })),
    ...input.payments.map(({ amount, unitPrice }) => ({
      kind: 'payment' as const,
      amount,
      unitPrice,
    })),
  ])

  return {
    current: segmentFrom(segments, today),
    coverage: computeCoverage({
      served,
      ledger,
      today,
      unitPrice: unitPrice ?? 0,
    }),
    opening: opening ? { days: opening.days, reason: opening.reason } : null,
    unitPrice,
    served,
    ledger,
    calendar: mealCalendar({
      segments,
      isClosed: input.isClosed,
      absences,
      served,
      ownedDays: ledger.days,
      today,
    }),
  }
}
