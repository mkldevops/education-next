import type { Enrollment, Payment, Plan, Student } from '@/generated/prisma/client'
import { PaymentHistoryTable } from './payment-history-table'

type PaymentWithRelation = Payment & {
  enrollment: Enrollment & {
    student: Student & {
      person: { name: string; lastname: string }
    }
    plan: Plan
  }
}

type Props = {
  payments: PaymentWithRelation[]
  locale: string
}

export function PaymentsTab({ payments, locale }: Props) {
  return (
    <div className="space-y-6">
      <PaymentHistoryTable payments={payments} locale={locale} />
    </div>
  )
}
