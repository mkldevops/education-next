import { BalanceBadge, Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { EnrollmentStatusBadge, PaymentMethodLabel } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { requireSchoolScope } from '../../../_lib/auth-helper'
import { notFoundTitle } from '../../../_lib/page-metadata'
import { EnrollmentActions } from './_components/enrollment-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const scope = await requireSchoolScope()

  const enrollment = scope.isAdmin
    ? await db.enrollment.findUnique({
        where: { id_schoolId: { id, schoolId: scope.schoolId } },
        include: { student: { include: { person: true } } },
      })
    : await db.enrollment.findFirst({
        where: {
          id,
          schoolId: scope.schoolId,
          student: { person: { families: { some: { familyId: scope.familyId } } } },
        },
        include: { student: { include: { person: true } } },
      })

  return {
    title: enrollment
      ? `${enrollment.student.person.name} ${enrollment.student.person.lastname}`
      : await notFoundTitle(locale),
  }
}

export default async function EnrollmentDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollmentDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()
  const isAdmin = scope.isAdmin

  const [enrollment, availableClasses] = await Promise.all([
    db.enrollment.findUnique({
      where: { id_schoolId: { id, schoolId: scope.schoolId }, isActive: true },
      include: {
        student: {
          include: {
            person: {
              include: {
                families: { include: { family: true } },
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
          orderBy: { startAt: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    }),
    isAdmin
      ? db.classPeriod.findMany({
          where: { schoolId: scope.schoolId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [],
  ])

  if (!enrollment) notFound()

  if (!isAdmin) {
    const belongsToFamily = enrollment.student.person.families.some(
      (fp) => fp.familyId === scope.familyId
    )
    if (!belongsToFamily) notFound()
  }

  const totalAmount = Number(enrollment.totalAmount)
  const discount = Number(enrollment.discount)
  const totalPaid = enrollment.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remaining = calculateRemainingBalance(totalAmount, totalPaid)
  const currentClassId = enrollment.classAssignments.find((a) => !a.endAt)?.classPeriod.id ?? null
  const familyName =
    enrollment.student.person.families.length > 0
      ? enrollment.student.person.families[0].family.name
      : '-'
  const familyContext = enrollment.student.person.families[0]?.family

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
          <h1 className="text-2xl font-bold text-gray-900">
            <Link
              href={`/dashboard/students/${enrollment.student.id}`}
              className="hover:text-primary hover:underline"
            >
              {enrollment.student.person.name} {enrollment.student.person.lastname}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <EnrollmentActions
          enrollmentId={enrollment.id}
          status={enrollment.status}
          isAdmin={isAdmin}
          currentClassId={currentClassId}
          availableClasses={availableClasses}
          currentDiscount={discount}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('plan')}</p>
              <p className="mt-1 text-sm text-gray-900">{enrollment.plan.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('status')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <EnrollmentStatusBadge status={enrollment.status} />
                {remaining > 0 && (
                  <BalanceBadge
                    label={t('balanceBadge', { amount: formatCurrency(remaining, locale) })}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('family')}</p>
              <p className="mt-1 text-sm text-gray-900">{familyName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('registered')}</p>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t('pricing')}</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('totalAmount')}</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totalAmount, locale)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('discount')}</span>
              <span className="font-medium text-gray-900">{formatCurrency(-discount, locale)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('totalPaid')}</span>
              <span className="font-medium text-gray-900">{formatCurrency(totalPaid, locale)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span className="text-gray-900">{t('remaining')}</span>
              <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                {formatCurrency(remaining, locale)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('classAssignments')}</h2>
        {enrollment.classAssignments.length === 0 ? (
          <p className="text-sm text-gray-500">-</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-gray-400">
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
                      <Link
                        href={`/dashboard/classes/${a.classPeriod.id}`}
                        className="text-primary hover:underline"
                      >
                        {a.classPeriod.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{a.classPeriod.level.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{a.classPeriod.period.name}</td>
                    <td className="py-3 text-gray-600">
                      {new Date(a.startAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('payments')}</h2>
        {enrollment.payments.length === 0 ? (
          <p className="text-sm text-gray-500">-</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-gray-400">
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
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      {formatCurrency(p.amount, locale)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      <PaymentMethodLabel method={p.method} />
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{p.reference ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {new Date(p.paidAt).toLocaleDateString(locale)}
                    </td>
                    <td className="py-3 text-gray-600">
                      {p.cashedAt ? new Date(p.cashedAt).toLocaleDateString(locale) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
