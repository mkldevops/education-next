import { Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { EnrollmentStatusBadge } from '@/features/enums'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Payment,
  Person,
  Plan,
  Student,
} from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { EnrollButton } from './enroll-button'

type StudentWithRelation = {
  person: Person & {
    student: Student & {
      enrollments: Array<
        Enrollment & {
          plan: Plan
          payments: Payment[]
          classAssignments: Array<
            ClassAssignment & {
              classPeriod: ClassPeriod
            }
          >
        }
      >
    }
  }
}

type Props = {
  student: StudentWithRelation
  locale: string
  familyId: string
  isAdmin: boolean
}

export async function ChildCard({ student, locale, familyId, isAdmin }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  const { person } = student
  const enrollments = person.student.enrollments

  const birthday = new Date(person.student.birthday)
  const age = Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  return (
    <Card className="p-4 rounded-xl border overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg flex-shrink-0">
          {person.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
            {person.name} {person.lastname}
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            {t('childCard.age', { age })} • {birthday.toLocaleDateString(locale)}
          </p>
        </div>
      </div>

      {person.student.allergies && (
        <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs font-medium text-red-900">{t('childCard.allergies')}</p>
          <p className="text-xs text-red-800 mt-0.5">{person.student.allergies}</p>
        </div>
      )}

      {Array.isArray(person.student.languagesAtHome) &&
        person.student.languagesAtHome.length > 0 && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-900">{t('childCard.languages')}</p>
            <p className="text-xs text-blue-800 mt-0.5">
              {person.student.languagesAtHome.join(', ')}
            </p>
          </div>
        )}

      <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
        {enrollments.length > 0 ? (
          enrollments.map((enrollment) => {
            const totalAmount = Number(enrollment.totalAmount)
            const totalPaid = enrollment.payments.reduce((sum, p) => sum + Number(p.amount), 0)
            const remaining = totalAmount - totalPaid
            const paidPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0

            return (
              <div key={enrollment.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-900">{enrollment.plan.name}</p>
                  <EnrollmentStatusBadge status={enrollment.status} />
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(paidPercentage)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('childCard.paymentProgress', { plan: enrollment.plan.name })}
                  className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
                >
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(paidPercentage, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {formatCurrency(totalPaid, locale)} / {formatCurrency(totalAmount, locale)}
                  </span>
                  {remaining > 0 && (
                    <span className="text-xs font-medium text-amber-600">
                      {t('childCard.remaining', { amount: formatCurrency(remaining, locale) })}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-xs text-gray-600 text-center py-2">{t('childCard.noEnrollments')}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/dashboard/students/${person.student.id}`}
          className="flex-1 px-3 py-2 text-xs font-medium text-center rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
        >
          {t('childCard.viewProfile')}
        </Link>
        {isAdmin && enrollments.length === 0 && (
          <EnrollButton familyId={familyId} studentId={person.student.id} />
        )}
      </div>
    </Card>
  )
}
