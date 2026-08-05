import { EmptyState } from '@peaklab/ui'
import { CalendarDays, ChevronRight, GraduationCap } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
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
import { formatCurrency } from '@/lib/decimal'

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
}

export async function EnrollmentList({ enrollments, locale }: Props) {
  const t = await getTranslations('dashboard.pages.studentDetails')

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

        return (
          <li key={enrollment.id}>
            <Link
              href={`/dashboard/enrollments/${enrollment.id}`}
              className="group block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-gray-50/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{enrollment.plan.name}</p>
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </div>
                  {assignment && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                      <GraduationCap className="h-4 w-4 text-gray-400" />
                      {assignment.name}
                      <span className="text-gray-300">·</span>
                      {assignment.level.name}
                      <span className="text-gray-300">·</span>
                      {assignment.period.name}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-primary" />
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="tabular-nums text-gray-600">
                    {formatCurrency(paid, locale)} / {formatCurrency(total, locale)}
                  </span>
                  {remaining > 0 ? (
                    <span className="font-medium tabular-nums text-amber-600">
                      {t('enrollmentList.remaining', { amount: formatCurrency(remaining, locale) })}
                    </span>
                  ) : (
                    <span className="font-medium text-emerald-600">
                      {t('enrollmentList.settled')}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                {t('enrollmentList.registeredOn', {
                  date: new Date(enrollment.registeredAt).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
