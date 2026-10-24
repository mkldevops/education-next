import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { groupFamilyPayments } from '@/domain/payment'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import type { FamilyDetailEnrollment, FamilyDetailPayment } from '../_lib/family-detail'

type Props = {
  enrollments: FamilyDetailEnrollment[]
  payments: FamilyDetailPayment[]
  locale: string
  currency: string
  /** Faux quand l'école a désactivé les paiements : ni versement, ni formule dans le fil. */
  paymentsEnabled: boolean
}

type Activity = {
  id: string
  date: Date
  type: 'payment' | 'enrollment' | 'assignment'
  title: string
  description: string
  student?: string
  color: string
}

export async function ActivityFeed({
  enrollments,
  payments,
  locale,
  currency,
  paymentsEnabled,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  const activities: Activity[] = []

  groupFamilyPayments(paymentsEnabled ? payments : []).forEach((payment) => {
    activities.push({
      id: `payment-${payment.id}`,
      date: payment.paidAt,
      type: 'payment',
      title: t('activity.payment'),
      description: formatCurrency(payment.amount, locale, currency),
      student: payment.lines
        .map(
          (line) =>
            `${line.enrollment.student.person.name} ${line.enrollment.student.person.lastname}`
        )
        .join(', '),
      color: 'bg-green-500',
    })
  })

  enrollments.forEach((enrollment) => {
    activities.push({
      id: `enrollment-${enrollment.id}`,
      date: enrollment.registeredAt,
      type: 'enrollment',
      title: t('activity.enrollment'),
      description:
        paymentsEnabled && enrollment.plan.name !== UNPRICED_PLAN_NAME ? enrollment.plan.name : '',
      student: enrollment.studentName,
      color: 'bg-blue-500',
    })

    enrollment.classAssignments.forEach((assignment) => {
      activities.push({
        id: `assignment-${assignment.id}`,
        date: assignment.startAt,
        type: 'assignment',
        title: t('activity.assignment'),
        description: assignment.classPeriod.name,
        student: enrollment.studentName,
        color: 'bg-purple-500',
      })
    })
  })

  const sortedActivities = activities
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)

  if (sortedActivities.length === 0) {
    return (
      <Card className="p-6 text-center text-graphite-600">
        <p className="text-sm">{t('activity.empty')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sortedActivities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 pb-3 last:pb-0 last:border-0 border-b border-alabaster-700"
        >
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${activity.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-graphite">{activity.title}</p>
            {activity.description && (
              <p className="text-xs text-graphite-600 mt-0.5 line-clamp-2">
                {activity.description}
              </p>
            )}
            {activity.student && (
              <p className="text-xs font-medium text-graphite mt-0.5">{activity.student}</p>
            )}
            <p className="text-xs text-graphite-600 mt-1">{formatDate(activity.date, locale)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
