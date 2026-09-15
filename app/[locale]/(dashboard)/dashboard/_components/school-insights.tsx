import { BarChart, Card, ProgressBar } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import type { SchoolInsights } from '../_lib/school-insights'

interface Props {
  insights: SchoolInsights
  locale: string
}

const CLASSES_LISTED = 6

export async function SchoolInsightsSection({ insights, locale }: Props) {
  const t = await getTranslations('dashboard.insights')
  const { payments, classes, levels } = insights

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthCaption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const compact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  const chart =
    payments?.monthly.map((point) => {
      const date = new Date(`${point.month}-01T00:00:00`)

      return {
        label: monthLabel.format(date),
        value: point.amount,
        caption: `${monthCaption.format(date)} · ${formatCurrency(point.amount, locale)}`,
      }
    }) ?? []

  return (
    <div className="space-y-5">
      {payments && (
        <Card className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-graphite">{t('collectionTitle')}</h2>
            <Link
              href="/dashboard/payments"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              {t('viewPayments')}
            </Link>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-graphite-600">{t('collected')}</dt>
              <dd className="text-xl font-bold text-graphite">
                {formatCurrency(payments.totals.collected, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-graphite-600">{t('remaining')}</dt>
              <dd className="text-xl font-bold text-graphite">
                {formatCurrency(payments.totals.remaining, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-graphite-600">{t('collectionRate')}</dt>
              <dd className="mt-2">
                <ProgressBar value={payments.totals.collectionRate} />
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <BarChart
              data={chart}
              formatValue={(value) => (value > 0 ? compact.format(value) : '—')}
              emptyMessage={t('noCollection')}
              height={140}
            />
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-graphite">{t('classFillTitle')}</h2>
            <Link
              href="/dashboard/classes"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              {t('viewClasses')}
            </Link>
          </div>
          {classes.length === 0 ? (
            <p className="mt-4 text-graphite-600">{t('noClasses')}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {classes.slice(0, CLASSES_LISTED).map((classPeriod) => (
                <li key={classPeriod.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/dashboard/classes/${classPeriod.id}`}
                      className="text-sm font-medium text-primary hover:text-primary-hover"
                    >
                      {classPeriod.name}
                    </Link>
                    <span className="text-sm text-graphite">
                      {classPeriod.enrolled}/{classPeriod.capacity}
                      <span className="ml-2 text-xs text-graphite-600">{classPeriod.level}</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={
                        classPeriod.capacity > 0
                          ? (classPeriod.enrolled / classPeriod.capacity) * 100
                          : 0
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-graphite">{t('levelsTitle')}</h2>
          <div className="mt-6">
            <BarChart
              data={levels.map((level) => ({
                label: level.level,
                value: level.enrolled,
                caption: t('studentsCount', { count: level.enrolled }),
              }))}
              formatValue={(value) => String(value)}
              emptyMessage={t('noClasses')}
              height={140}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
