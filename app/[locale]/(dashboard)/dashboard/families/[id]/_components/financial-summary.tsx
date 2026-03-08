'use client'

import { useTranslations } from 'next-intl'
import { formatAmount } from '@/lib/decimal'

type Props = {
  totalDue: number
  totalPaid: number
  totalDiscount: number
  remainingBalance: number
}

export function FinancialSummary({ totalDue, totalPaid, totalDiscount, remainingBalance }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails')

  const circumference = 2 * Math.PI * 45
  const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0
  const paidOffset = circumference - (paidPercentage / 100) * circumference

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center py-4">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <title>Financial breakdown chart</title>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={paidOffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{Math.round(paidPercentage)}%</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('financial.paid')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
          <div>
            <p className="text-xs text-gray-600">{t('financial.paid')}</p>
            <p className="text-sm font-semibold text-green-900">€{formatAmount(totalPaid)}</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>

        <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
          <div>
            <p className="text-xs text-gray-600">{t('financial.remaining')}</p>
            <p className="text-sm font-semibold text-amber-900">
              €{formatAmount(remainingBalance)}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-amber-500" />
        </div>

        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <p className="text-xs text-gray-600">{t('financial.total')}</p>
            <p className="text-sm font-semibold text-blue-900">€{formatAmount(totalDue)}</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-blue-500" />
        </div>
      </div>

      {totalDiscount > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600">Réductions appliquées</p>
          <p className="text-sm font-semibold text-gray-900">€{formatAmount(totalDiscount)}</p>
        </div>
      )}
    </div>
  )
}
