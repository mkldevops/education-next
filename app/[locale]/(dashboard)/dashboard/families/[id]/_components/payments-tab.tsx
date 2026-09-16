import type { FamilyDetailPayment } from '../_lib/family-detail'
import { PaymentHistoryTable } from './payment-history-table'

type Props = {
  payments: FamilyDetailPayment[]
  locale: string
}

export function PaymentsTab({ payments, locale }: Props) {
  return (
    <div className="space-y-6">
      <PaymentHistoryTable payments={payments} locale={locale} />
    </div>
  )
}
