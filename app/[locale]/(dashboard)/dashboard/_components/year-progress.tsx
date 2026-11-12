import { cn } from '@/lib/utils'

const percent = (part: number, total: number) =>
  total > 0 ? `${Math.min(100, Math.max(0, (100 * part) / total))}%` : '0%'

type YearProgressKey =
  | 'year.label'
  | 'year.progress'
  | 'year.barLabel'
  | 'year.barLabelLate'
  | 'year.barLabelSimple'
  | 'figures.paid'
  | 'figures.expectedToDate'
  | 'figures.remaining'
  | 'figures.total'

interface Props {
  t: (key: YearProgressKey, values?: Record<string, string>) => string
  money: (amount: number) => string
  paid: number
  total: number
  overdue: number
  expected: number
  scheduled: boolean
  showExpected: boolean
  className?: string
}

/** Barre de l'année scolaire : versé en vert, retard hachuré, trait à l'attendu à ce jour. */
export function YearProgress({
  t,
  money,
  paid,
  total,
  overdue,
  expected,
  scheduled,
  showExpected,
  className,
}: Props) {
  const amounts = {
    paid: money(paid),
    total: money(total),
    expected: money(expected),
    overdue: money(overdue),
  }
  const barLabel = !showExpected
    ? t('year.barLabelSimple', amounts)
    : overdue > 0
      ? t('year.barLabelLate', amounts)
      : t('year.barLabel', amounts)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-graphite-600">
        <span>{t('year.label')}</span>
        <span className="tabular-nums">{t('year.progress', amounts)}</span>
      </div>
      <div
        role="img"
        aria-label={barLabel}
        className="relative h-2.5 rounded-full bg-alabaster-700"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-600"
          style={{ width: percent(paid, total) }}
        />
        {showExpected && overdue > 0 && (
          <div
            className="absolute inset-y-0 rounded-r-full bg-[repeating-linear-gradient(135deg,var(--color-red-600)_0_3px,white_3px_6px)] outline outline-1 -outline-offset-1 outline-red-600"
            style={{ left: percent(paid, total), width: percent(overdue, total) }}
          />
        )}
        {showExpected && (
          <div
            className="absolute -inset-y-1 -ml-px w-0.5 rounded-xs bg-graphite ring-[1.5px] ring-white"
            style={{ left: percent(expected, total) }}
          />
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-graphite-600">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs bg-emerald-600" />
            {t('figures.paid')}
          </dt>
          <dd className="font-semibold tabular-nums text-graphite">{amounts.paid}</dd>
        </div>
        {scheduled ? (
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-graphite-600">
              {showExpected && (
                <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-graphite" />
              )}
              {t('figures.expectedToDate')}
            </dt>
            <dd className="font-semibold tabular-nums text-graphite">{amounts.expected}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs text-graphite-600">{t('figures.total')}</dt>
            <dd className="font-semibold tabular-nums text-graphite">{amounts.total}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-graphite-600">{t('figures.remaining')}</dt>
          <dd className="font-semibold tabular-nums text-graphite">
            {money(Math.max(0, total - paid))}
          </dd>
        </div>
      </dl>
    </div>
  )
}
