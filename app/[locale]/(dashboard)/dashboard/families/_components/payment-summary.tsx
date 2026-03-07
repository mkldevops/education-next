import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { formatAmount } from '@/lib/decimal'

interface PaymentSummaryProps {
  totalDue: number
  totalDiscount: number
  totalPaid: number
}

export async function PaymentSummary({ totalDue, totalDiscount, totalPaid }: PaymentSummaryProps) {
  const t = await getTranslations('dashboard.pages.familyDetails.paymentSummary')

  const remaining = Math.max(0, totalDue - totalDiscount - totalPaid)

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('title')}</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <p className="text-sm text-gray-500">{t('totalDue')}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">€{formatAmount(totalDue)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('discount')}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            -€{formatAmount(totalDiscount)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('totalPaid')}</p>
          <p className="mt-1 text-lg font-semibold text-green-600">€{formatAmount(totalPaid)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{t('remaining')}</p>
          <p
            className={`mt-1 text-lg font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            €{formatAmount(remaining)}
          </p>
        </div>
      </div>
    </Card>
  )
}
