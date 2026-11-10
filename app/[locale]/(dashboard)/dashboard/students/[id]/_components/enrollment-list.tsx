import { EmptyState, StatusBadge } from '@peaklab/ui'
import { CalendarDays, Check, ChevronRight, GraduationCap } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import {
  type InstallmentCoverage,
  installmentCoverage,
  paymentInstallments,
  readPaymentSchedule,
  startMonthFromDate,
} from '@/domain/payment-schedule'
import { EnrollmentStatusBadge } from '@/features/enums'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Level,
  Payment,
  Period,
  Plan,
} from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatDateLong } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'

type EnrollmentWithRelation = Enrollment & {
  plan: Plan
  payments: Payment[]
  classAssignments: Array<
    ClassAssignment & {
      classPeriod: ClassPeriod & { level: Level; period: Period }
    }
  >
}

type Props = {
  enrollments: EnrollmentWithRelation[]
  locale: string
  currency: string
  paymentsEnabled: boolean
}

const COVERAGE_TONE: Record<InstallmentCoverage['status'], string> = {
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PARTIAL: 'border-amber-200 bg-amber-50 text-amber-700',
  UNPAID: 'border-alabaster-700 bg-white text-graphite-700',
}

function coverageOf(enrollment: EnrollmentWithRelation, paid: number, currency: string) {
  const period = enrollment.classAssignments.reduce<Period | null>(
    (latest, row) =>
      !latest || row.classPeriod.period.startAt > latest.startAt ? row.classPeriod.period : latest,
    null
  )
  if (!period) return []
  return installmentCoverage(
    paymentInstallments(
      readPaymentSchedule(enrollment.plan.paymentSchedule),
      Number(enrollment.totalAmount),
      period.startAt,
      currency,
      startMonthFromDate(enrollment.startMonth)
    ),
    paid
  )
}

export async function EnrollmentList({ enrollments, locale, currency, paymentsEnabled }: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails')
  const tEnrollments = await getTranslations('dashboard.pages.enrollments')
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })

  if (enrollments.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t('enrollmentList.empty')}
        description={t('enrollmentList.emptyHint')}
      />
    )
  }

  return (
    <ul className="space-y-3">
      {enrollments.map((enrollment) => {
        const total = Number(enrollment.totalAmount)
        const paid = enrollment.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const remaining = Math.max(0, total - paid)
        const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0
        const assignment = enrollment.classAssignments[0]?.classPeriod
        const coverage = paymentsEnabled ? coverageOf(enrollment, paid, currency) : []

        return (
          <li key={enrollment.id}>
            <Link
              href={`/dashboard/enrollments/${enrollment.id}`}
              className="group block rounded border border-alabaster-700 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-alabaster-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {paymentsEnabled &&
                      (enrollment.plan.name === UNPRICED_PLAN_NAME ? (
                        <StatusBadge status="amber" label={tEnrollments('unpriced.badge')} />
                      ) : (
                        <p className="font-medium text-graphite">{enrollment.plan.name}</p>
                      ))}
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </div>
                  {assignment && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-graphite-600">
                      <GraduationCap className="h-4 w-4 text-graphite-700" />
                      {assignment.name}
                      <span className="text-graphite-800">·</span>
                      {assignment.level.name}
                      <span className="text-graphite-800">·</span>
                      {assignment.period.name}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-graphite-800 transition-colors group-hover:text-foreground" />
              </div>

              {paymentsEnabled && (
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-alabaster-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="tabular-nums text-graphite-600">
                      {formatCurrency(paid, locale, currency)} /{' '}
                      {formatCurrency(total, locale, currency)}
                    </span>
                    {remaining > 0 ? (
                      <span className="font-medium tabular-nums text-amber-600">
                        {t('enrollmentList.remaining', {
                          amount: formatCurrency(remaining, locale, currency),
                        })}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-600">
                        {t('enrollmentList.settled')}
                      </span>
                    )}
                  </div>
                  {coverage.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 text-xs text-graphite-600">
                        {t('enrollmentList.coveredMonths')}
                      </p>
                      <ul className="flex flex-wrap gap-1">
                        {coverage.map((installment) => {
                          const month = monthFormat.format(new Date(installment.dueDate))
                          const label = t(
                            `enrollmentList.installmentStatus.${installment.status}`,
                            {
                              month,
                              paid: formatCurrency(installment.paidAmount, locale, currency),
                              amount: formatCurrency(installment.amount, locale, currency),
                            }
                          )
                          return (
                            <li
                              key={installment.dueDate}
                              title={label}
                              aria-label={label}
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs capitalize ${COVERAGE_TONE[installment.status]}`}
                            >
                              {installment.status === 'PAID' && (
                                <Check aria-hidden className="h-3 w-3" />
                              )}
                              {month}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-center gap-1.5 border-t border-alabaster-800 pt-3 text-xs text-graphite-600">
                <CalendarDays className="h-3.5 w-3.5 text-graphite-700" />
                {t('enrollmentList.registeredOn', {
                  date: formatDateLong(enrollment.registeredAt, locale),
                })}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
