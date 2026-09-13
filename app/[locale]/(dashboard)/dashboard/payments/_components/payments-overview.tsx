import { BarChart, Card, ProgressBar } from '@peaklab/ui'
import { Banknote, HandCoins, Landmark, Wallet } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { PaymentMethod } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import type { PaymentStats } from '@/use-cases/payments/payment-stats'

interface Props {
  stats: PaymentStats
  locale: string
  periodName: string | null
}

export async function PaymentsOverview({ stats, locale, periodName }: Props) {
  const t = await getTranslations('dashboard.pages.payments.stats')
  const tScope = await getTranslations('dashboard.stats')
  const tMethod = await getTranslations('paymentMethod')
  const { totals, monthly, methods, families } = stats

  const scope = periodName ? tScope('scopePeriod', { period: periodName }) : tScope('scopeAll')
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthCaption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const compact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  const chart = monthly.map((point) => {
    const date = new Date(`${point.month}-01T00:00:00`)

    return {
      label: monthLabel.format(date),
      value: point.amount,
      caption: `${monthCaption.format(date)} · ${formatCurrency(point.amount, locale)} · ${t('paymentsCount', { count: point.count })}`,
    }
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('due')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">
                {formatCurrency(totals.due, locale)}
              </p>
              <p className="mt-1 text-xs text-graphite-600">{scope}</p>
            </div>
            <div className="rounded bg-primary-light p-3">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('collected')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">
                {formatCurrency(totals.collected, locale)}
              </p>
              <p className="mt-1 text-xs text-graphite-600">
                {t('paymentsCount', { count: totals.paymentCount })}
              </p>
            </div>
            <div className="rounded bg-primary-light p-3">
              <HandCoins className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={totals.collectionRate} />
            <p className="mt-1 text-xs text-graphite-600">{t('collectionRate')}</p>
          </div>
        </Card>

        <Card className="border-amber-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('remaining')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">
                {formatCurrency(totals.remaining, locale)}
              </p>
              <p className="mt-1 text-xs text-graphite-600">
                {t('outstandingEnrollments', {
                  outstanding: totals.outstandingCount,
                  total: totals.enrollmentCount,
                })}
              </p>
            </div>
            <div className="rounded bg-amber-100 p-3">
              <Wallet className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('uncashed')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">
                {formatCurrency(totals.uncashedAmount, locale)}
              </p>
              <p className="mt-1 text-xs text-graphite-600">
                {t('uncashedCount', { count: totals.uncashedCount })}
              </p>
            </div>
            <div className="rounded bg-blue-100 p-3">
              <Banknote className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-graphite">{t('monthlyTitle')}</h2>
          <p className="text-sm text-graphite-600">
            {t('monthlySubtitle', { months: chart.length })}
          </p>
        </div>
        <div className="mt-6">
          <BarChart
            data={chart}
            formatValue={(value) => (value > 0 ? compact.format(value) : '—')}
            emptyMessage={t('noCollection')}
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-graphite">{t('methodsTitle')}</h2>
          {methods.length === 0 ? (
            <p className="mt-4 text-graphite-600">{t('noCollection')}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {methods.map((method) => (
                <li key={method.method}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-graphite">
                      {tMethod(method.method as PaymentMethod)}
                    </span>
                    <span className="text-sm text-graphite">
                      {formatCurrency(method.amount, locale)}
                      <span className="ml-2 text-xs text-graphite-600">
                        {t('paymentsCount', { count: method.count })}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={method.share} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-graphite">{t('outstandingTitle')}</h2>
            <p className="text-sm text-graphite-600">{t('outstandingSubtitle')}</p>
          </div>
          {families.length === 0 ? (
            <p className="mt-4 text-graphite-600">{t('noOutstanding')}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {families.map((family) => (
                <li key={family.familyId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/dashboard/families/${family.familyId}`}
                      className="text-sm font-medium text-primary hover:text-primary-hover"
                    >
                      {family.familyName}
                    </Link>
                    <span className="text-sm font-medium text-graphite">
                      {formatCurrency(family.remaining, locale)}
                      <span className="ml-2 text-xs text-graphite-600">
                        {t('outOf', { amount: formatCurrency(family.due, locale) })}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={family.collectionRate} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
