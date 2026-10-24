import { computeCoverage, type MealCoverage, replayLedger, servedDays } from './meal-ledger'
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
}

/**
 * Fiche d'un compte : segment en cours ou à venir, et couverture au tarif du jour. Sans
 * encaissement (lot 3), le grand livre ne compte que les ajustements.
 */
export function summarizeMealAccount(input: {
  segments: readonly Segment[]
  adjustments: ReadonlyArray<{ kind: string; days: number; reason: string }>
  prices: readonly MealPriceEntry[]
  isClosed: (day: string) => boolean
  today: string
}): MealAccountSummary {
  const { segments, adjustments, today } = input
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
  })
  const unitPrice = priceOn(input.prices, today)
  const opening = adjustments.find((adjustment) => adjustment.kind === 'OPENING')

  return {
    current: segmentFrom(segments, today),
    coverage: computeCoverage({
      served,
      ledger: replayLedger(adjustments.map(({ days }) => ({ kind: 'adjustment', days }))),
      today,
      unitPrice: unitPrice ?? 0,
    }),
    opening: opening ? { days: opening.days, reason: opening.reason } : null,
    unitPrice,
  }
}
