import type { FamilyPaymentTrackingDetail } from '@/use-cases/payments/payment-tracking'
import type { FamilyDetailPayment } from '../_lib/family-detail'
import { PaymentHistoryTable } from './payment-history-table'
import { PaymentTrackingCard } from './payment-tracking-card'

type Props = {
  payments: FamilyDetailPayment[]
  locale: string
  currency: string
  timeZone: string
  tracking: FamilyPaymentTrackingDetail | null
  canCancel?: boolean
}

export async function PaymentsTab({
  payments,
  locale,
  currency,
  timeZone,
  tracking,
  canCancel,
}: Props) {
  const showTracking = tracking && (tracking.tracked || tracking.annualAmount > 0)
  return (
    <div className="space-y-6">
      {showTracking && (
        <PaymentTrackingCard
          tracking={tracking}
          locale={locale}
          currency={currency}
          timeZone={timeZone}
        />
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
