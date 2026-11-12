'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/decimal'
import { HorizonSegmented, useUrlHorizon } from '../../_components/remaining-horizon-switch'
import { YearProgress } from '../../_components/year-progress'
import { groupFamilies, type TrackingFamily } from './payment-tracking-groups'

interface Props {
  families: TrackingFamily[]
  uncashedCount: number
  locale: string
  currency: string
}

export function PaymentsSummary({ families, uncashedCount, locale, currency }: Props) {
  const t = useTranslations('dashboard.pages.payments.tracking.summary')
  const tYear = useTranslations('dashboard.pages.familyDetails.paymentTracking')
  const [horizon, setHorizon] = useUrlHorizon()
  const money = (amount: number) => formatCurrency(amount, locale, currency)

  const { total, settledCount, scopeCount } = groupFamilies(families, horizon)
  const year = families.filter((family) => family.annualAmount > 0)
  const sum = (pick: (family: TrackingFamily) => number) =>
    year.reduce((amount, family) => amount + pick(family), 0)
  const annual = sum((family) => family.annualAmount)
  const paid = sum((family) => Math.min(family.creditedPaid, family.annualAmount))
  const overdue = sum((family) => family.overdueAmount)
  const expected = sum((family) => (family.tracked ? family.expectedToDate : 0))
  const tracked = year.some((family) => family.tracked)

  return (
    <Card className="space-y-3 p-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-graphite-600">{t(horizon)}</p>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-2xl font-bold tabular-nums text-graphite">{money(total)}</span>
            {overdue > 0 && (
              <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-danger">
                {t('overdue', { amount: money(overdue) })}
              </span>
            )}
          </p>
        </div>
        <HorizonSegmented value={horizon} onSelect={setHorizon} />
      </div>
      {annual > 0 && (
        <YearProgress
          t={tYear}
          money={money}
          paid={paid}
          total={annual}
          overdue={overdue}
          expected={expected}
          scheduled={tracked}
          showExpected={tracked && paid < annual}
        />
      )}
      <p className="text-xs text-graphite-600">
        {[
          scopeCount > 0 &&
            t(horizon === 'month' ? 'upToDateCount' : 'settledCount', {
              count: settledCount,
              total: scopeCount,
            }),
          t('uncashed', { count: uncashedCount }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </Card>
  )
}
