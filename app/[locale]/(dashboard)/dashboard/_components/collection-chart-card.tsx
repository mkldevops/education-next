import { BarChart, Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import type { ChartGranularity, ChartView, CollectionPoint } from '@/domain/collection-chart'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { CollectionChartControls } from './collection-chart-controls'

interface Props {
  series: CollectionPoint[]
  title?: string
  showPaymentsLink?: boolean
  view: ChartView
  locale: string
  currency: string
}

const TOOLTIP_FORMAT: Record<ChartGranularity, Intl.DateTimeFormatOptions> = {
  day: { day: 'numeric', month: 'short' },
  month: { month: 'short', year: 'numeric' },
  year: { year: 'numeric' },
}

function keyDate(key: string): Date {
  const [year, month = '01', day = '01'] = key.split('-')
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

export async function CollectionChartCard({
  series,
  view,
  locale,
  currency,
  title,
  showPaymentsLink = true,
}: Props) {
  const t = await getTranslations('dashboard.insights')
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' })
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const tooltip = new Intl.DateTimeFormat(locale, {
    ...TOOLTIP_FORMAT[view.granularity],
    timeZone: 'UTC',
  })
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })

  const label = (date: Date, index: number) => {
    if (view.granularity === 'year') return String(date.getUTCFullYear())
    if (view.granularity === 'month') return month.format(date)
    return index === 0 || date.getUTCDate() === 1 ? tooltip.format(date) : day.format(date)
  }

  const chart = series.map((point, index) => {
    const date = keyDate(point.key)
    return {
      label: label(date, index),
      value: point.amount,
      tooltip: `${tooltip.format(date)} · ${formatCurrency(point.amount, locale, currency)}`,
    }
  })

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title ?? t('collectionTitle')}</h2>
        {showPaymentsLink && (
          <Link
            href="/dashboard/payments"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('viewPayments')}
          </Link>
        )}
      </div>
      <div className="mt-3">
        <CollectionChartControls view={view} />
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
  )
}
