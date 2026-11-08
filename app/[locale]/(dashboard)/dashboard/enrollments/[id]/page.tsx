import { BalanceBadge, Breadcrumbs, Card, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { totalPaidAmount } from '@/domain/payment'
import { startMonthFromDate, startMonthToDate } from '@/domain/payment-schedule'
import { EnrollmentStatusBadge, PaymentMethodLabel } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { hasActiveSchoolStaffAccess, isActiveSchoolAdmin } from '@/lib/school-context'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { SchoolSwitchPrompt } from '../../../_components/school-switch-prompt'
import { requireSchoolSession } from '../../../_lib/auth-helper'
import { familyLinksVisibleTo, resolveDeepLink, staffOrLinkedTo } from '../../../_lib/deep-link'
import { deepLinkTitle } from '../../../_lib/page-metadata'
import { canSwitchSchool } from '../../../_lib/school-switch'
import { EnrollmentActions } from '../_components/enrollment-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

/** Résolveur unique de la page ET de `generateMetadata`. */
const resolveEnrollment = cache((id: string) =>
  resolveDeepLink({
    requireStaff: false,
    find: (access) =>
      db.enrollment.findFirst({
        where: {
          id,
          isActive: true,
          schoolId: { in: access.schoolIds },
          ...staffOrLinkedTo(access, {
            student: {
              person: {
                families: { some: { family: { users: { some: { userId: access.userId } } } } },
              },
            },
          }),
        },
        include: {
          student: {
            include: {
              person: {
                include: {
                  families: { where: familyLinksVisibleTo(access), include: { family: true } },
                },
              },
            },
          },
          plan: true,
          classAssignments: {
            include: {
              classPeriod: {
                include: { level: true, period: true },
              },
            },
            orderBy: { startAt: 'asc' as const },
          },
          payments: {
            where: { isActive: true },
            orderBy: { paidAt: 'desc' as const },
          },
        },
      }),
  })
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  await requireSchoolSession()

  return deepLinkTitle(
    locale,
    await resolveEnrollment(id),
    (enrollment) => `${enrollment.student.person.name} ${enrollment.student.person.lastname}`
  )
}

export default async function EnrollmentDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollmentDetails')
  const tEnrollments = await getTranslations('dashboard.pages.enrollments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const context = await requireSchoolSession()
  const resolution = await resolveEnrollment(id)

  if (resolution.status === 'notFound') notFound()
  if (resolution.status === 'otherSchool')
    return (
      <SchoolSwitchPrompt
        schoolId={resolution.school.id}
        schoolName={resolution.school.name}
        canSwitch={await canSwitchSchool()}
      />
    )

  const enrollment = resolution.resource
  const isAdmin = isActiveSchoolAdmin(context)
  // Un enseignant à accès élargi gère l'inscription sans en voir l'argent.
  const isStaff = await hasActiveSchoolStaffAccess(context)
  const paymentsEnabled = (isAdmin || !isStaff) && (await isPaymentsEnabled(enrollment.schoolId))
  const { currency } = await getSchoolRegionalSettings(enrollment.schoolId)

  // Le changement de classe reste dans la période de l'inscription (`periodMismatch` sinon).
  const enrollmentPeriodId = (
    enrollment.classAssignments.find((a) => !a.endAt) ?? enrollment.classAssignments.at(-1)
  )?.classPeriod.periodId
  const availableClasses = isStaff
    ? await db.classPeriod.findMany({
        where: {
          schoolId: enrollment.schoolId,
          isActive: true,
          ...(enrollmentPeriodId ? { periodId: enrollmentPeriodId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const availablePlans =
    isAdmin && paymentsEnabled
      ? await db.plan.findMany({
          where: {
            schoolId: enrollment.schoolId,
            isActive: true,
            name: { not: UNPRICED_PLAN_NAME },
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

  const enrollmentPeriod = (
    enrollment.classAssignments.find((a) => !a.endAt) ?? enrollment.classAssignments.at(-1)
  )?.classPeriod.period
  const startMonth = startMonthFromDate(enrollment.startMonth)
  const totalAmount = Number(enrollment.totalAmount)
  const discount = Number(enrollment.discount)
  const totalPaid = totalPaidAmount(enrollment.payments)
  const remaining = calculateRemainingBalance(totalAmount, totalPaid)
  const currentClassId = enrollment.classAssignments.find((a) => !a.endAt)?.classPeriod.id ?? null
  const familyContext = resolveDebtorFamily(enrollment.student.person.families)?.family
  const familyName = familyContext?.name ?? '-'

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          familyContext
            ? {
                label: familyContext.name,
                href: `/dashboard/families/${familyContext.id}`,
              }
            : { label: tBreadcrumbs('enrollments'), href: '/dashboard/enrollments' },
          {
            label: `${enrollment.student.person.name} ${enrollment.student.person.lastname}`,
          },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">
            <Link
              href={`/dashboard/students/${enrollment.student.id}`}
              className="hover:text-foreground hover:underline"
            >
              {enrollment.student.person.name} {enrollment.student.person.lastname}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-graphite-600">{t('subtitle')}</p>
        </div>
        <EnrollmentActions
          enrollmentId={enrollment.id}
          status={enrollment.status}
          isAdmin={isStaff}
          currentClassId={currentClassId}
          availableClasses={availableClasses}
          currentTotalAmount={paymentsEnabled ? totalAmount : 0}
          currency={currency}
          paymentsEnabled={paymentsEnabled}
          planName={enrollment.plan.name}
          availablePlans={availablePlans}
          startMonth={
            isAdmin
              ? {
                  value: startMonth,
                  min: startMonthFromDate(enrollmentPeriod?.startAt) ?? undefined,
                  max: startMonthFromDate(enrollmentPeriod?.endAt) ?? undefined,
                }
              : undefined
          }
        />
      </div>

      <div className={paymentsEnabled ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {paymentsEnabled && (
              <div>
                <p className="text-sm font-medium text-graphite-600">{t('plan')}</p>
                <p className="mt-1 text-sm text-graphite">
                  {enrollment.plan.name === UNPRICED_PLAN_NAME ? (
                    <StatusBadge status="amber" label={tEnrollments('unpriced.badge')} />
                  ) : (
                    enrollment.plan.name
                  )}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('status')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <EnrollmentStatusBadge status={enrollment.status} />
                {paymentsEnabled && remaining > 0 && (
                  <BalanceBadge
                    label={t('balanceBadge', {
                      amount: formatCurrency(remaining, locale, currency),
                    })}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('family')}</p>
              <p className="mt-1 text-sm text-graphite">{familyName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('registered')}</p>
              <p className="mt-1 text-sm text-graphite">
                {formatDate(enrollment.registeredAt, locale)}
              </p>
            </div>
          </div>
        </Card>

        {paymentsEnabled && (
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-graphite">{t('pricing')}</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-graphite-600">{t('totalAmount')}</span>
                <span className="font-medium text-graphite">
                  {formatCurrency(totalAmount, locale, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-graphite-600">{t('discount')}</span>
                <span className="font-medium text-graphite">
                  {formatCurrency(-discount, locale, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-graphite-600">{t('startMonth')}</span>
                <span className="font-medium text-graphite">
                  {startMonth
                    ? startMonthToDate(startMonth).toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })
                    : t('startMonthDefault')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-graphite-600">{t('totalPaid')}</span>
                <span className="font-medium text-graphite">
                  {formatCurrency(totalPaid, locale, currency)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span className="text-graphite">{t('remaining')}</span>
                <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {formatCurrency(remaining, locale, currency)}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-graphite">{t('classAssignments')}</h2>
        {enrollment.classAssignments.length === 0 ? (
          <p className="text-sm text-graphite-600">-</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-graphite-600">
                  <th className="pb-2 text-left">{t('classAssignmentTable.class')}</th>
                  <th className="pb-2 text-left">{t('classAssignmentTable.level')}</th>
                  <th className="pb-2 text-left">{t('classAssignmentTable.period')}</th>
                  <th className="pb-2 text-left">{t('classAssignmentTable.startDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollment.classAssignments.map((a) => (
                  <tr key={a.id} className="text-sm">
                    <td className="py-3 pr-4 font-medium">
                      {isStaff ? (
                        <Link
                          href={`/dashboard/classes/${a.classPeriod.id}`}
                          className="text-foreground hover:underline"
                        >
                          {a.classPeriod.name}
                        </Link>
                      ) : (
                        // La page classe est réservée à l'équipe : un parent n'y aurait qu'un 404.
                        a.classPeriod.name
                      )}
                    </td>
                    <td className="py-3 pr-4 text-graphite-600">{a.classPeriod.level.name}</td>
                    <td className="py-3 pr-4 text-graphite-600">{a.classPeriod.period.name}</td>
                    <td className="py-3 text-graphite-600">{formatDate(a.startAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paymentsEnabled && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-graphite">{t('payments')}</h2>
          {enrollment.payments.length === 0 ? (
            <p className="text-sm text-graphite-600">-</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs font-medium uppercase tracking-wider text-graphite-600">
                    <th className="pb-2 text-left">{t('paymentTable.amount')}</th>
                    <th className="pb-2 text-left">{t('paymentTable.method')}</th>
                    <th className="pb-2 text-left">{t('paymentTable.reference')}</th>
                    <th className="pb-2 text-left">{t('paymentTable.paidAt')}</th>
                    <th className="pb-2 text-left">{t('paymentTable.cashedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrollment.payments.map((p) => (
                    <tr key={p.id} className="text-sm">
                      <td className="py-3 pr-4 font-medium text-graphite">
                        {formatCurrency(p.amount, locale, currency)}
                      </td>
                      <td className="py-3 pr-4 text-graphite-600">
                        <PaymentMethodLabel method={p.method} />
                      </td>
                      <td className="py-3 pr-4 text-graphite-600">{p.reference ?? '-'}</td>
                      <td className="py-3 pr-4 text-graphite-600">
                        {formatDate(p.paidAt, locale)}
                      </td>
                      <td className="py-3 text-graphite-600">
                        {p.cashedAt ? formatDate(p.cashedAt, locale) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
