import { type DecimalLike, roundHalfUp, toNumber } from '@/lib/decimal'

export const CHART_GRANULARITIES = ['day', 'month', 'year'] as const
export const CHART_RANGES = ['7d', '30d', '3m', '6m', '12m'] as const

export type ChartGranularity = (typeof CHART_GRANULARITIES)[number]
type ChartRange = (typeof CHART_RANGES)[number]
export type ChartView = { granularity: ChartGranularity; range: ChartRange }

export const DEFAULT_CHART_VIEW: ChartView = { granularity: 'month', range: '12m' }

/**
 * Périodes lisibles pour chaque découpage : un jour sur douze mois ferait 365 barres, un mois
 * sur sept jours une seule. La première entrée sert de repli quand le découpage change.
 */
const RANGES_BY_GRANULARITY: Record<ChartGranularity, readonly ChartRange[]> = {
  day: ['7d', '30d', '3m'],
  month: ['3m', '6m', '12m'],
  year: ['12m'],
}

const GRANULARITY_BY_RANGE: Record<ChartRange, ChartGranularity> = {
  '7d': 'day',
  '30d': 'day',
  '3m': 'month',
  '6m': 'month',
  '12m': 'month',
}

const RANGE_SPAN: Record<ChartRange, { days: number } | { months: number }> = {
  '7d': { days: 7 },
  '30d': { days: 30 },
  '3m': { months: 3 },
  '6m': { months: 6 },
  '12m': { months: 12 },
}

function isGranularity(value: unknown): value is ChartGranularity {
  return CHART_GRANULARITIES.includes(value as ChartGranularity)
}

function isRange(value: unknown): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange)
}

function fits(view: ChartView) {
  return RANGES_BY_GRANULARITY[view.granularity].includes(view.range)
}

/** Vue enregistrée en base : une valeur inconnue ou une combinaison illisible retombe sur le défaut. */
export function readChartView(granularity: unknown, range: unknown): ChartView {
  if (!isGranularity(granularity) || !isRange(range)) return DEFAULT_CHART_VIEW
  const view = { granularity, range }
  return fits(view) ? view : DEFAULT_CHART_VIEW
}

/** Nouvelle vue après un clic : l'axe choisi l'emporte, l'autre s'ajuste s'il le faut. */
export function changeChartView(current: ChartView, change: Partial<ChartView>): ChartView {
  const next = { ...current, ...change }
  if (fits(next)) return next
  return change.range
    ? { granularity: GRANULARITY_BY_RANGE[change.range], range: change.range }
    : { granularity: next.granularity, range: RANGES_BY_GRANULARITY[next.granularity][0] }
}

export type CollectionWindow = {
  /** Premier instant affiché, en UTC. */
  from: Date
  /** Borne exclue, en UTC. */
  to: Date
  granularity: ChartGranularity
}

export type CollectionPoint = {
  /** `YYYY-MM-DD`, `YYYY-MM` ou `YYYY` selon le découpage, en UTC. */
  key: string
  amount: number
  count: number
}

function dayStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset))
}

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1))
}

/**
 * Fenêtre du graphique, en UTC comme les dates de paiement saisies.
 *
 * Elle se termine au dernier paiement sans dépasser aujourd'hui : une période
 * scolaire passée resterait sinon vide. Les périodes en mois partent d'un début de mois.
 */
export function collectionWindow(
  latestPaidAt: Date | null,
  view: ChartView,
  reference: Date = new Date()
): CollectionWindow {
  const cap = dayStart(reference, 1)
  const end = latestPaidAt && latestPaidAt < cap ? latestPaidAt : reference
  const span = RANGE_SPAN[view.range]
  const from = 'days' in span ? dayStart(end, 1 - span.days) : monthStart(end, 1 - span.months)
  const to = view.granularity === 'day' ? dayStart(end, 1) : monthStart(end, 1)

  return { from, to, granularity: view.granularity }
}

function bucketKey(date: Date, granularity: ChartGranularity): string {
  const iso = date.toISOString()
  if (granularity === 'day') return iso.slice(0, 10)
  if (granularity === 'month') return iso.slice(0, 7)
  return iso.slice(0, 4)
}

function bucketKeys(window: CollectionWindow): string[] {
  const keys: string[] = []
  let cursor = window.from
  while (cursor < window.to) {
    keys.push(bucketKey(cursor, window.granularity))
    cursor =
      window.granularity === 'day'
        ? dayStart(cursor, 1)
        : window.granularity === 'month'
          ? monthStart(cursor, 1)
          : new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1))
  }
  return keys
}

/** Série des encaissements sur la fenêtre, découpée par jour, mois ou année, cases vides comprises. */
export function collectionSeries(
  payments: Array<{ amount: DecimalLike; paidAt: Date }>,
  window: CollectionWindow
): CollectionPoint[] {
  const buckets = new Map<string, { amount: number; count: number }>()

  for (const payment of payments) {
    if (payment.paidAt < window.from || payment.paidAt >= window.to) continue
    const key = bucketKey(payment.paidAt, window.granularity)
    const bucket = buckets.get(key) ?? { amount: 0, count: 0 }
    bucket.amount += toNumber(payment.amount)
    bucket.count += 1
    buckets.set(key, bucket)
  }

  return bucketKeys(window).map((key) => {
    const bucket = buckets.get(key)
    return { key, amount: roundHalfUp(bucket?.amount ?? 0), count: bucket?.count ?? 0 }
  })
}
