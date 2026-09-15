import { getTranslations } from 'next-intl/server'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Payment,
  Plan,
  Student,
} from '@/generated/prisma/client'
import { ActivityFeed } from './activity-feed'

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
  paymentsEnabled: boolean
}

export async function ActivityTab({ enrollments, payments, locale, paymentsEnabled }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="space-y-6">
      {enrollments.length > 0 ? (
        <ActivityFeed
          enrollments={enrollments}
          payments={payments}
          locale={locale}
          paymentsEnabled={paymentsEnabled}
        />
      ) : (
        <p className="text-sm text-graphite-600 text-center py-8">{t('sections.noActivity')}</p>
      )}
    </div>
  )
}
