import { Card, cn } from '@peaklab/ui'
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { type PaymentTrackingState, paymentTrackingState } from '@/domain/payment-tracking-state'
import { formatCurrency } from '@/lib/decimal'
import type { FamilyPaymentTrackingDetail } from '@/use-cases/payments/payment-tracking'

type Props = {
  tracking: FamilyPaymentTrackingDetail
  locale: string
  currency: string
  timeZone: string
  reference?: Date
}

type State = PaymentTrackingState

export { paymentTrackingState }

const accent: Record<State, string> = {
  untracked: 'border-l-alabaster-400',
  settled: 'border-l-emerald-600',
  late: 'border-l-red-600',
  due: 'border-l-sky-600',
  ahead: 'border-l-emerald-600',
  upToDate: 'border-l-emerald-600',
}

const percent = (part: number, total: number) =>
  `${Math.min(100, Math.max(0, (100 * part) / total))}%`

export async function PaymentTrackingCard({
  tracking,
  locale,
  currency,
  timeZone,
  reference = new Date(),
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails.paymentTracking')
  const money = (amount: number) => formatCurrency(amount, locale, currency)
  const state = paymentTrackingState(tracking)
  const { annualAmount, creditedPaid, expectedToDate, overdueAmount, dueThisMonth } = tracking
  const advance = Math.max(0, creditedPaid - expectedToDate)
  const remainingYear = Math.max(0, annualAmount - creditedPaid)
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone }).format(reference)
  const scheduled = tracking.tracked && state !== 'settled'
  const showMarker = scheduled && tracking.fullyScheduled
  const amounts = {
    paid: money(creditedPaid),
    total: money(annualAmount),
    expected: money(expectedToDate),
    overdue: money(overdueAmount),
  }

  const badge = {
    untracked: {
      icon: MinusCircle,
      tone: 'border-alabaster-500 bg-alabaster-900 text-graphite-600',
    },
    settled: { icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    late: { icon: AlertTriangle, tone: 'border-red-200 bg-red-50 text-red-800' },
    due: { icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    ahead: { icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    upToDate: { icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  }[state]
  const BadgeIcon = badge.icon
  const badgeLabel = {
    ahead: t('status.ahead', { amount: money(advance) }),
    late: t('status.late', { amount: amounts.overdue }),
    due: t('status.upToDate'),
    upToDate: t('status.upToDate'),
    settled: t('status.settled'),
    untracked: t('status.untracked'),
  }[state]

  const headline =
    state === 'settled'
      ? t('nothingDueYear')
      : dueThisMonth > 0
        ? money(dueThisMonth)
        : t('nothingDue')
  const monthPart = Math.max(0, dueThisMonth - overdueAmount)
  const late = (chunks: ReactNode) => <span className="font-semibold text-red-700">{chunks}</span>
  const detail = {
    late:
      monthPart > 0
        ? t.rich('detail.lateAndMonth', { overdue: amounts.overdue, month: money(monthPart), late })
        : t.rich('detail.lateOnly', { overdue: amounts.overdue, late }),
    ahead: t('detail.ahead', { amount: money(advance) }),
    due: t('detail.dueNotLate'),
    upToDate: t('detail.upToDate'),
    settled: t('detail.settled'),
    untracked: t('detail.untracked'),
  }[state]
  const how =
    state === 'late'
      ? t('how.late', { ...amounts, amount: amounts.overdue })
      : state === 'ahead'
        ? t('how.ahead', { ...amounts, amount: money(advance) })
        : t('how.upToDate', amounts)
  const barLabel = !showMarker
    ? t('year.barLabelSimple', amounts)
    : overdueAmount > 0
      ? t('year.barLabelLate', amounts)
      : t('year.barLabel', amounts)

  return (
    <Card
      role="region"
      aria-label={t('title')}
      className={cn('space-y-3 border-l-4 p-4 sm:p-5', accent[state])}
      data-state={state}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1.5 text-sm font-semibold',
          badge.tone
        )}
      >
        <BadgeIcon aria-hidden="true" className="size-4 shrink-0" />
        {badgeLabel}
      </span>

      {state !== 'untracked' && (
        <div>
          {state !== 'settled' && (
            <p className="text-xs text-graphite-600">{t('dueLabel', { month: monthName })}</p>
          )}
          <p className="text-2xl font-bold tabular-nums text-graphite">{headline}</p>
        </div>
      )}
      <p className="text-sm text-graphite-600">{detail}</p>

      {annualAmount > 0 && (
        <div className="space-y-2 border-t border-alabaster-700 pt-3">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-graphite-600">
            <span>{t('year.label')}</span>
            <span className="tabular-nums">{t('year.progress', amounts)}</span>
          </div>
          <div
            role="img"
            aria-label={barLabel}
            className="relative h-2.5 rounded-full bg-alabaster-700"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-600"
              style={{ width: percent(creditedPaid, annualAmount) }}
            />
            {showMarker && overdueAmount > 0 && (
              <div
                className="absolute inset-y-0 rounded-r-full bg-[repeating-linear-gradient(135deg,var(--color-red-600)_0_3px,white_3px_6px)] outline outline-1 -outline-offset-1 outline-red-600"
                style={{
                  left: percent(creditedPaid, annualAmount),
                  width: percent(overdueAmount, annualAmount),
                }}
              />
            )}
            {showMarker && (
              <div
                className="absolute -inset-y-1 -ml-px w-0.5 rounded-xs bg-graphite ring-[1.5px] ring-white"
                style={{ left: percent(expectedToDate, annualAmount) }}
              />
            )}
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-graphite-600">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-xs bg-emerald-600" />
                {t('figures.paid')}
              </dt>
              <dd className="font-semibold tabular-nums text-graphite">{amounts.paid}</dd>
            </div>
            {scheduled ? (
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-graphite-600">
                  {showMarker && (
                    <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-graphite" />
                  )}
                  {t('figures.expectedToDate')}
                </dt>
                <dd className="font-semibold tabular-nums text-graphite">{amounts.expected}</dd>
              </div>
            ) : (
              <div>
                <dt className="text-xs text-graphite-600">{t('figures.total')}</dt>
                <dd className="font-semibold tabular-nums text-graphite">{amounts.total}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-graphite-600">{t('figures.remaining')}</dt>
              <dd className="font-semibold tabular-nums text-graphite">{money(remainingYear)}</dd>
            </div>
          </dl>
        </div>
      )}

      {scheduled && (
        <details className="text-xs text-graphite-600">
          <summary className="cursor-pointer underline underline-offset-2">
            {t('how.summary')}
          </summary>
          <p className="mt-1">{how}</p>
        </details>
      )}
    </Card>
  )
}
