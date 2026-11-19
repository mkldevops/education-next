import { Card, cn, EmptyState } from '@peaklab/ui'
import { Receipt } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { formatChildcareMonth } from '@/domain/childcare'
import { formatCurrency } from '@/lib/decimal'
import type {
  StudentPaymentCoverage,
  StudentPaymentHistory,
  StudentPaymentService,
} from '../_lib/student-payment-history'

type Props = {
  history: StudentPaymentHistory
  locale: string
  currency: string
  timeZone: string
}

const SERVICE_TONE: Record<StudentPaymentService, string> = {
  TUITION: 'bg-blue-100 text-blue-800',
  CANTEEN: 'bg-amber-100 text-amber-800',
  CHILDCARE: 'bg-violet-100 text-violet-800',
  SNACK: 'bg-emerald-100 text-emerald-800',
}

const DAY_MS = 86_400_000

export async function PaymentHistory({ history, locale, currency, timeZone }: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails.paymentHistory')
  const tMethods = await getTranslations('dashboard.pages.payments.record.methods')

  // Un règlement d'écolage ne porte qu'un jour, stocké à minuit UTC ; un reçu de caisse porte
  // l'instant de l'encaissement, lu dans le fuseau de l'école.
  const formatPaidAt = (date: Date) =>
    date.toLocaleDateString(locale, {
      dateStyle: 'medium',
      timeZone: date.getTime() % DAY_MS === 0 ? 'UTC' : timeZone,
    })
  // `paidThroughAtReceipt` est un `@db.Date` : formaté en UTC, il garde son jour.
  const formatDay = (date: Date) => date.toLocaleDateString(locale, { timeZone: 'UTC' })
  const describe = (coverage: StudentPaymentCoverage) => {
    switch (coverage.kind) {
      case 'period':
        return coverage.name
      case 'mealDays':
        return coverage.paidThrough
          ? t('mealDetail', { days: coverage.days, date: formatDay(coverage.paidThrough) })
          : t('mealDays', { days: coverage.days })
      case 'month':
        return formatChildcareMonth(coverage.month, locale)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-graphite">{t('title')}</h2>
      {history.entries.length === 0 ? (
        <EmptyState icon={Receipt} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-alabaster-800">
            {history.entries.map((entry) => {
              const coverage = describe(entry.coverage)
              return (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 sm:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-sm text-graphite tabular-nums">
                        {formatPaidAt(entry.paidAt)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          SERVICE_TONE[entry.service]
                        )}
                      >
                        {t(`services.${entry.service}`)}
                      </span>
                    </div>
                    <p className="min-w-0 truncate text-xs text-graphite-600">
                      {coverage && (
                        <>
                          {coverage}
                          <span className="mx-1.5 text-graphite-800">·</span>
                        </>
                      )}
                      {tMethods(entry.method)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-graphite">
                    {formatCurrency(entry.amount, locale, currency)}
                  </span>
                </li>
              )
            })}
          </ul>
          {history.hasMore && (
            <p className="border-t border-alabaster-800 px-4 py-2 text-xs text-graphite-600">
              {t('limited', { count: history.entries.length })}
            </p>
          )}
        </Card>
      )}
    </section>
  )
}
