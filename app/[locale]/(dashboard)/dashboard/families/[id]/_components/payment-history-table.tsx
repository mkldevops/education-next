import { EmptyState } from '@peaklab/ui'
import { Receipt } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { Enrollment, Payment, PaymentMethod, Plan, Student } from '@/generated/prisma/client'
import { formatDateLong } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'

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

const METHOD_STYLES: Record<PaymentMethod, string> = {
  CARD: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  TRANSFER: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  CASH: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CHECK: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  STRIPE: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
}

function MethodBadge({ method, label }: { method: PaymentMethod; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        METHOD_STYLES[method] ?? 'bg-gray-50 text-gray-700 ring-gray-600/20'
      )}
    >
      {label}
    </span>
  )
}

export async function PaymentHistoryTable({ payments, locale }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails.paymentHistory')

  if (payments.length === 0) {
    return <EmptyState icon={Receipt} title={t('noPayments')} description={t('noPaymentsHint')} />
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const pending = payments.filter((p) => p.method === 'CHECK' && !p.cashedAt)
  const pendingTotal = pending.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t('count', { count: payments.length })} · {formatCurrency(total, locale)}
          </p>
        </div>
        {pending.length > 0 && (
          <p className="rounded bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
            {t('pendingSummary', {
              count: pending.length,
              amount: formatCurrency(pendingTotal, locale),
            })}
          </p>
        )}
      </header>

      <div className="hidden overflow-hidden rounded border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/70">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('student')}
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('amount')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('method')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('reference')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('paidAt')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('cashedAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((payment) => (
              <tr key={payment.id} className="transition-colors hover:bg-gray-50/70">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {payment.enrollment.student.person.name}{' '}
                    {payment.enrollment.student.person.lastname}
                  </p>
                  <p className="text-xs text-gray-500">{payment.enrollment.plan.name}</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                  {formatCurrency(payment.amount, locale)}
                </td>
                <td className="px-4 py-3">
                  <MethodBadge method={payment.method} label={t(`methods.${payment.method}`)} />
                </td>
                <td className="px-4 py-3">
                  {payment.reference ? (
                    <span className="font-mono text-xs text-gray-600">{payment.reference}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {formatDateLong(payment.paidAt, locale)}
                </td>
                <td className="px-4 py-3">
                  {payment.cashedAt ? (
                    <span className="tabular-nums text-gray-600">
                      {formatDateLong(payment.cashedAt, locale)}
                    </span>
                  ) : payment.method === 'CHECK' ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {t('notCashed')}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50/70">
              <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('total')}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                {formatCurrency(total, locale)}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {payment.enrollment.student.person.name}{' '}
                  {payment.enrollment.student.person.lastname}
                </p>
                <p className="truncate text-xs text-gray-500">{payment.enrollment.plan.name}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-gray-900">
                {formatCurrency(payment.amount, locale)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method={payment.method} label={t(`methods.${payment.method}`)} />
              {payment.reference && (
                <span className="font-mono text-xs text-gray-600">{payment.reference}</span>
              )}
            </div>

            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-gray-500">{t('paidAt')}</dt>
                <dd className="tabular-nums text-gray-700">
                  {formatDateLong(payment.paidAt, locale)}
                </dd>
              </div>
              {(payment.cashedAt || payment.method === 'CHECK') && (
                <div className="flex gap-1.5">
                  <dt className="text-gray-500">{t('cashedAt')}</dt>
                  <dd
                    className={cn(
                      'tabular-nums',
                      payment.cashedAt ? 'text-gray-700' : 'text-amber-700'
                    )}
                  >
                    {payment.cashedAt ? formatDateLong(payment.cashedAt, locale) : t('notCashed')}
                  </dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}
