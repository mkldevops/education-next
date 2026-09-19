import { BarChart, Card, ProgressBar } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { Banknote, HandCoins, Landmark, Wallet } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import type { PaymentMethod } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { PaymentStats } from '@/use-cases/payments/payment-stats'

const KPI_TONES = {
  primary: { tile: 'bg-primary-light', icon: 'text-primary' },
  amber: { tile: 'bg-amber-100', icon: 'text-amber-600' },
  blue: { tile: 'bg-blue-100', icon: 'text-blue-600' },
} as const

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
        <KpiCard
          label={t('due')}
          value={formatCurrency(totals.due, locale)}
          caption={scope}
          icon={Landmark}
          tone="primary"
        />
        <KpiCard
          label={t('collected')}
          value={formatCurrency(totals.collected, locale)}
          caption={t('paymentsCount', { count: totals.paymentCount })}
          icon={HandCoins}
          tone="primary"
        >
          <div className="mt-4">
            <ProgressBar value={totals.collectionRate} />
            <p className="mt-1 text-xs text-graphite-600">{t('collectionRate')}</p>
          </div>
        </KpiCard>
        <KpiCard
          label={t('remaining')}
          value={formatCurrency(totals.remaining, locale)}
          caption={t('outstandingEnrollments', {
            outstanding: totals.outstandingCount,
            total: totals.enrollmentCount,
          })}
          icon={Wallet}
          tone="amber"
          className="border-amber-200"
        />
        <KpiCard
          label={t('uncashed')}
          value={formatCurrency(totals.uncashedAmount, locale)}
          caption={t('uncashedCount', { count: totals.uncashedCount })}
          icon={Banknote}
          tone="blue"
        />
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

function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  className,
  children,
}: {
  label: string
  value: string
  caption: ReactNode
  icon: LucideIcon
  tone: keyof typeof KPI_TONES
  className?: string
  children?: ReactNode
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-graphite-600">{label}</p>
          <p className="mt-2 text-3xl font-bold text-graphite">{value}</p>
          <p className="mt-1 text-xs text-graphite-600">{caption}</p>
        </div>
        <div className={cn('rounded p-3', KPI_TONES[tone].tile)}>
          <Icon className={cn('h-6 w-6', KPI_TONES[tone].icon)} />
        </div>
      </div>
      {children}
    </Card>
  )
}
