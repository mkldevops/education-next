import { Card } from '@peaklab/ui'
import type { Enrollment, Payment, PaymentMethod, Plan, Student } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { formatAmount } from '@/lib/decimal'

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

function getPaymentMethodColor(method: PaymentMethod): string {
  switch (method) {
    case 'CARD':
      return 'bg-blue-100 text-blue-900'
    case 'TRANSFER':
      return 'bg-violet-100 text-violet-900'
    case 'CASH':
      return 'bg-green-100 text-green-900'
    case 'CHECK':
      return 'bg-amber-100 text-amber-900'
    default:
      return 'bg-gray-100 text-gray-900'
  }
}

export async function PaymentHistoryTable({ payments, locale }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  if (payments.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-600">
        <p className="text-sm">{t('paymentHistory.noPayments')}</p>
      </Card>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.student')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.amount')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.method')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.reference')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.paidAt')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                {t('paymentHistory.cashedAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {payment.enrollment.student.person.name}{' '}
                  {payment.enrollment.student.person.lastname}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                  €{formatAmount(payment.amount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentMethodColor(payment.method)}`}
                  >
                    {t(`paymentHistory.methods.${payment.method}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{payment.reference || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {new Date(payment.paidAt).toLocaleDateString(locale)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {payment.cashedAt ? new Date(payment.cashedAt).toLocaleDateString(locale) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
