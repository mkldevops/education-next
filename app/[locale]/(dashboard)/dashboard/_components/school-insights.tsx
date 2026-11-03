import { BarChart, Card, ProgressBar } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { classFillRate, type SchoolInsights } from '../_lib/school-insights'

interface Props {
  insights: SchoolInsights
  locale: string
  currency: string
}

const CLASSES_LISTED = 6

function sameLabel(name: string, level: string) {
  return name.includes(level) || level.includes(name)
}

export async function SchoolInsightsSection({ insights, locale, currency }: Props) {
  const t = await getTranslations('dashboard.insights')
  const { payments, classes } = insights

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthCaption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const compact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  const chart =
    payments?.monthly.map((point) => {
      const date = new Date(`${point.month}-01T00:00:00`)

      return {
        label: monthLabel.format(date),
        value: point.amount,
        caption: `${monthCaption.format(date)} · ${formatCurrency(point.amount, locale, currency)}`,
      }
    }) ?? []

  return (
    <div className="space-y-6">
      {payments && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t('collectionTitle')}</h2>
            <Link
              href="/dashboard/payments"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('viewPayments')}
            </Link>
          </div>
          <div className="mt-4">
            <BarChart
              data={chart}
              className="gap-1"
              formatValue={(value) => (value > 0 ? compact.format(value) : '—')}
              emptyMessage={t('noCollection')}
              height={180}
            />
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t('classFillTitle')}</h2>
          <Link
            href="/dashboard/classes"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('viewClasses')}
          </Link>
        </div>
        {classes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('noClasses')}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {classes.slice(0, CLASSES_LISTED).map((classPeriod) => (
              <li key={classPeriod.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/dashboard/classes/${classPeriod.id}`}
                    className="truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {classPeriod.name}
                  </Link>
                  <span className="shrink-0 text-sm text-foreground tabular-nums">
                    {classPeriod.enrolled}/{classPeriod.capacity}
                    {!sameLabel(classPeriod.name, classPeriod.level) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {classPeriod.level}
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={classFillRate(classPeriod) * 100} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
