import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Payment,
  Plan,
  Student,
} from '@/generated/prisma/client'
import { formatCurrency } from '@/lib/decimal'

type EnrollmentWithRelation = Enrollment & {
  plan: Plan
  studentName?: string
  classAssignments: Array<
    ClassAssignment & {
      classPeriod: ClassPeriod
    }
  >
}

type PaymentWithRelation = Payment & {
  enrollment: Enrollment & {
    student: Student & {
      person: { name: string; lastname: string }
    }
    plan: Plan
  }
}

type Props = {
  enrollments: EnrollmentWithRelation[]
  payments: PaymentWithRelation[]
  locale: string
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

export async function ActivityFeed({ enrollments, payments, locale }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  const activities: Activity[] = []

  payments.forEach((payment) => {
    activities.push({
      id: `payment-${payment.id}`,
      date: payment.paidAt,
      type: 'payment',
      title: t('activity.payment'),
      description: `${formatCurrency(payment.amount, locale)} — ${payment.enrollment.plan.name}`,
      student: `${payment.enrollment.student.person.name} ${payment.enrollment.student.person.lastname}`,
      color: 'bg-green-500',
    })
  })

  enrollments.forEach((enrollment) => {
    activities.push({
      id: `enrollment-${enrollment.id}`,
      date: enrollment.registeredAt,
      type: 'enrollment',
      title: t('activity.enrollment'),
      description: enrollment.plan.name,
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
      <Card className="p-6 text-center text-gray-600">
        <p className="text-sm">{t('activity.empty')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sortedActivities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 pb-3 last:pb-0 last:border-0 border-b border-gray-200"
        >
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${activity.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{activity.title}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{activity.description}</p>
            {activity.student && (
              <p className="text-xs font-medium text-gray-700 mt-0.5">{activity.student}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{activity.date.toLocaleDateString(locale)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
