import { buttonVariants, Card, StatusBadge } from '@peaklab/ui'
import { getTranslations } from 'next-intl/server'
import { EnrollmentStatusBadge } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { calculateAge, formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { ReassignClassDialog } from '../../../enrollments/_components/reassign-class-dialog'
import type { FamilyDetailStudent } from '../_lib/family-detail'
import { ActivateEnrollmentButton } from './activate-enrollment-button'
import { EnrollButton } from './enroll-button'
import { EnrollmentMenu } from './enrollment-menu'

type ClassOption = {
  id: string
  name: string
}

type Props = {
  student: FamilyDetailStudent
  locale: string
  familyId: string
  isAdmin: boolean
  classes: ClassOption[]
  /**
   * Vrai quand l'élève n'a aucune inscription en cours sur la période sélectionnée, calculé
   * par la page sur les mêmes critères que `createEnrollment` : une inscription terminée ou
   * annulée n'empêche pas la réinscription, une inscription vivante oui.
   */
  canEnroll: boolean
  /** Faux quand l'école a désactivé les paiements : ni formule, ni montant, ni progression. */
  paymentsEnabled: boolean
}

export async function ChildCard({
  student,
  locale,
  familyId,
  isAdmin,
  classes,
  canEnroll,
  paymentsEnabled,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')
  const tEnrollments = await getTranslations('dashboard.pages.enrollments')

  const { person } = student
  const enrollments = person.student.enrollments

  const birthday = person.student.birthday ? new Date(person.student.birthday) : null
  const age = birthday ? calculateAge(birthday, new Date()) : null

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
          {birthday && age !== null && (
            <p className="text-xs text-graphite-600 mt-0.5">
              {t('childCard.age', { age })} • {formatDate(birthday, locale)}
            </p>
          )}
        </div>
        {enrollments.length > 0 && (
          <EnrollmentMenu
            studentId={person.student.id}
            enrollments={enrollments.map((enrollment) => ({
              id: enrollment.id,
              label:
                enrollment.classAssignments[0]?.classPeriod.name ??
                (paymentsEnabled && enrollment.plan.name !== UNPRICED_PLAN_NAME
                  ? enrollment.plan.name
                  : t('childCard.noClass')),
              classPeriodId: enrollment.classAssignments[0]?.classPeriod.id ?? null,
            }))}
          />
        )}
      </div>

      {person.student.allergies && (
        <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
          <p className="text-xs font-medium text-red-900">{t('childCard.allergies')}</p>
          <p className="text-xs text-red-800 mt-0.5">{person.student.allergies}</p>
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
                  {paymentsEnabled ? (
                    enrollment.plan.name === UNPRICED_PLAN_NAME ? (
                      <StatusBadge status="amber" label={tEnrollments('unpriced.badge')} />
                    ) : (
                      <p className="text-xs font-medium text-graphite">{enrollment.plan.name}</p>
                    )
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <EnrollmentStatusBadge status={enrollment.status} />
                    {isAdmin && enrollment.status === 'PENDING' && (
                      <ActivateEnrollmentButton enrollmentId={enrollment.id} />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {currentAssignment ? (
                    // Le nom de la classe porte déjà niveau et période : les répéter entre
                    // parenthèses n'ajoutait rien et noyait le lien.
                    <Link
                      href={`/dashboard/classes/${currentAssignment.classPeriod.id}`}
                      className="text-xs font-medium text-primary hover:text-primary-hover hover:underline"
                    >
                      {currentAssignment.classPeriod.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-graphite-600">{t('childCard.noClass')}</span>
                  )}
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

                {paymentsEnabled && (
                  <>
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
                  </>
                )}
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
        {isAdmin && canEnroll && <EnrollButton familyId={familyId} studentId={person.student.id} />}
      </div>
    </Card>
  )
}
