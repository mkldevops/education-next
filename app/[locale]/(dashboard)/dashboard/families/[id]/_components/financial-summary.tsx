'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/decimal'

type Props = {
  totalDue: number
  totalPaid: number
  totalDiscount: number
  remainingBalance: number
}

export function FinancialSummary({ totalDue, totalPaid, totalDiscount, remainingBalance }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails')
  const locale = useLocale()

  const circumference = 2 * Math.PI * 45
  const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0
  const paidOffset = circumference - (paidPercentage / 100) * circumference

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center py-4">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <title>{t('financial.chartTitle')}</title>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--color-alabaster-700)"
              strokeWidth="8"
            />
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
              <p className="text-2xl font-bold text-graphite">{Math.round(paidPercentage)}%</p>
              <p className="text-xs text-graphite-600 mt-0.5">{t('financial.paid')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
          <div>
            <p className="text-xs text-graphite-600">{t('financial.paid')}</p>
            <p className="text-sm font-semibold text-green-900">
              {formatCurrency(totalPaid, locale)}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>

        <div className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
          <div>
            <p className="text-xs text-graphite-600">{t('financial.remaining')}</p>
            <p className="text-sm font-semibold text-amber-900">
              {formatCurrency(remainingBalance, locale)}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-amber-500" />
        </div>

        <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
          <div>
            <p className="text-xs text-graphite-600">{t('financial.total')}</p>
            <p className="text-sm font-semibold text-blue-900">
              {formatCurrency(totalDue, locale)}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-blue-500" />
        </div>
      </div>

      {totalDiscount > 0 && (
        <div className="pt-2 border-t border-alabaster-700">
          <p className="text-xs text-graphite-600">{t('financial.discount')}</p>
          <p className="text-sm font-semibold text-graphite">
            {formatCurrency(totalDiscount, locale)}
          </p>
        </div>
      )}
    </div>
  )
}
