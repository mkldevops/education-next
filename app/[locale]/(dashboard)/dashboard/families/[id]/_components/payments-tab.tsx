import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { formatCurrency } from '@/lib/decimal'
import type { FamilyPaymentTracking } from '@/use-cases/payments/payment-tracking'
import type { FamilyDetailPayment } from '../_lib/family-detail'
import { PaymentHistoryTable } from './payment-history-table'

type Props = {
  payments: FamilyDetailPayment[]
  locale: string
  currency: string
  tracking: FamilyPaymentTracking | null
  canCancel?: boolean
}

export async function PaymentsTab({ payments, locale, currency, tracking, canCancel }: Props) {
  const t = await getTranslations('dashboard.pages.payments.stats')
  return (
    <div className="space-y-6">
      {tracking?.tracked && (
        <Card className="space-y-4 p-5">
          <p
            className={
              tracking.overdueAmount > 0 ? 'font-medium text-amber-700' : 'font-medium text-primary'
            }
          >
            {tracking.overdueAmount > 0 ? t('overdueAmount') : t('upToDate')}
          </p>
          <dl className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['expectedToDate', tracking.expectedToDate],
                ['paidToDate', tracking.paidToDate],
                ['overdueAmount', tracking.overdueAmount],
              ] as const
            ).map(([label, amount]) => (
              <div key={label}>
                <dt className="text-sm text-graphite-600">{t(label)}</dt>
                <dd className="font-semibold text-graphite">
                  {formatCurrency(amount, locale, currency)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-graphite-600">{t('overdueSubtitle')}</p>
        </Card>
      )}
      <PaymentHistoryTable
        payments={payments}
        locale={locale}
        currency={currency}
        canCancel={canCancel}
      />
    </div>
  )
}
