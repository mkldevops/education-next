import { buttonVariants, Card } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { EnrollmentStatusBadge } from '@/features/enums'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Level,
  Payment,
  Period,
  Person,
  Plan,
  Student,
} from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { ReassignClassDialog } from '../../../enrollments/_components/reassign-class-dialog'
import { ActivateEnrollmentButton } from './activate-enrollment-button'
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
              classPeriod: ClassPeriod & {
                level: Level
                period: Period
              }
            }
          >
        }
      >
    }
  }
}

type ClassOption = {
  id: string
  name: string
}

type Props = {
  student: StudentWithRelation
  locale: string
  familyId: string
  isAdmin: boolean
  classes: ClassOption[]
}

export async function ChildCard({ student, locale, familyId, isAdmin, classes }: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  const { person } = student
  const enrollments = person.student.enrollments

  const birthday = new Date(person.student.birthday)
  const age = Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  return (
    <Card className="flex h-full flex-col p-4 rounded border overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center text-lg flex-shrink-0">
          {person.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-graphite line-clamp-1">
            {person.name} {person.lastname}
          </h3>
          <p className="text-xs text-graphite-600 mt-0.5">
            {t('childCard.age', { age })} • {formatDate(birthday, locale)}
          </p>
        </div>
      </div>

      {person.student.allergies && (
        <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
          <p className="text-xs font-medium text-red-900">{t('childCard.allergies')}</p>
          <p className="text-xs text-red-800 mt-0.5">{person.student.allergies}</p>
        </div>
      )}

      {Array.isArray(person.student.languagesAtHome) &&
        person.student.languagesAtHome.length > 0 && (
          <div className="mb-3 p-2 bg-primary-light/50 rounded border border-primary/20">
            <p className="text-xs font-medium text-primary">{t('childCard.languages')}</p>
            <p className="text-xs text-graphite-600 mt-0.5">
              {person.student.languagesAtHome.join(', ')}
            </p>
          </div>
        )}

      <div className="space-y-2 mt-auto mb-4 pb-4 border-b border-alabaster-700">
        {enrollments.length > 0 ? (
          enrollments.map((enrollment) => {
            const totalAmount = Number(enrollment.totalAmount)
            const totalPaid = enrollment.payments.reduce((sum, p) => sum + Number(p.amount), 0)
            const remaining = totalAmount - totalPaid
            const paidPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0
            const currentAssignment = enrollment.classAssignments[0]
            const currentClassId = currentAssignment?.classPeriod.id ?? null

            return (
              <div key={enrollment.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-graphite">{enrollment.plan.name}</p>
                  <div className="flex items-center gap-2">
                    <EnrollmentStatusBadge status={enrollment.status} />
                    {isAdmin && enrollment.status === 'PENDING' && (
                      <ActivateEnrollmentButton enrollmentId={enrollment.id} />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-graphite-600">
                    {currentAssignment
                      ? `${t('childCard.class')}: ${currentAssignment.classPeriod.name} (${currentAssignment.classPeriod.level.name} — ${currentAssignment.classPeriod.period.name})`
                      : t('childCard.noClass')}
                  </span>
                  {isAdmin && (
                    <ReassignClassDialog
                      enrollmentId={enrollment.id}
                      currentClassId={currentClassId}
                      classes={classes}
                      triggerLabel={
                        currentAssignment ? t('childCard.changeClass') : t('childCard.assignClass')
                      }
                    />
                  )}
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(paidPercentage)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('childCard.paymentProgress', { plan: enrollment.plan.name })}
                  className="w-full bg-alabaster-700 rounded-full h-2 overflow-hidden"
                >
                  <div
                    className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(paidPercentage, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-graphite-600">
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
          <p className="text-xs text-graphite-600 text-center py-2">
            {t('childCard.noEnrollments')}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/dashboard/students/${person.student.id}`}
          className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'flex-1' })}
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
