import { Breadcrumbs, Card, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { ApplyDiscountDialog } from '../_components/apply-discount-dialog'
import { ReassignClassDialog } from '../_components/reassign-class-dialog'
import { EnrollmentActions } from './_components/enrollment-actions'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: { student: { include: { person: true } } },
  })

  return {
    title: enrollment
      ? `${enrollment.student.person.name} ${enrollment.student.person.lastname}`
      : 'Inscription',
  }
}

export default async function EnrollmentDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollmentDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          person: {
            include: {
              families: {
                include: {
                  family: true,
                },
              },
            },
          },
        },
      },
      plan: true,
      classAssignments: {
        include: {
          classPeriod: {
            include: {
              level: true,
              period: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: 'desc' },
      },
    },
  })

  if (!enrollment) notFound()

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const availableClasses = isAdmin
    ? await db.classPeriod.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const currentClassId = enrollment.classAssignments.find((a) => !a.endAt)?.classPeriodId ?? null

  if (!isAdmin) {
    const enrollmentFamily = enrollment.student.person.families.some(
      (fp) => fp.familyId === familyId
    )
    if (!enrollmentFamily) notFound()
  }

  const familyName =
    enrollment.student.person.families.length > 0
      ? enrollment.student.person.families[0].family.name
      : '-'

  const totalPaid = enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const remainingAmount = Number(enrollment.totalAmount) - Number(enrollment.discount) - totalPaid

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('enrollments'), href: '/dashboard/enrollments' },
          { label: `${enrollment.student.person.name} ${enrollment.student.person.lastname}` },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {enrollment.student.person.name} {enrollment.student.person.lastname}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('plan')}</h3>
            <p className="mt-1 text-sm text-gray-900">{enrollment.plan.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('status')}</h3>
            <div className="mt-1">
              <StatusBadge status={enrollment.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <EnrollmentActions enrollmentId={enrollment.id} status={enrollment.status} />
              {isAdmin && (enrollment.status === 'PENDING' || enrollment.status === 'ACTIVE') && (
                <>
                  <ReassignClassDialog
                    enrollmentId={enrollment.id}
                    currentClassId={currentClassId}
                    classes={availableClasses}
                  />
                  <ApplyDiscountDialog
                    enrollmentId={enrollment.id}
                    currentDiscount={Number(enrollment.discount)}
                  />
                </>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('family')}</h3>
            <p className="mt-1 text-sm text-gray-900">{familyName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('registered')}</h3>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{t('pricing')}</h2>
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('totalAmount')}</span>
            <span className="text-sm font-medium text-gray-900">
              €{formatAmount(enrollment.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('discount')}</span>
            <span className="text-sm font-medium text-gray-900">
              -€{formatAmount(enrollment.discount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('totalPaid')}</span>
            <span className="text-sm font-medium text-gray-900">€{formatAmount(totalPaid)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium text-gray-900">{t('remaining')}</span>
            <span className="font-medium text-gray-900">
              €{formatAmount(Math.max(0, remainingAmount))}
            </span>
          </div>
        </div>
      </Card>

      {enrollment.classAssignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('classAssignments')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('classAssignmentTable.class')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('classAssignmentTable.level')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('classAssignmentTable.period')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('classAssignmentTable.startDate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollment.classAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{assignment.classPeriod.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {assignment.classPeriod.level.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {assignment.classPeriod.period.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(assignment.startAt).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {enrollment.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('payments')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentTable.amount')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentTable.method')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentTable.reference')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentTable.paidAt')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentTable.cashedAt')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollment.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{formatAmount(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.method}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(payment.paidAt).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {payment.cashedAt
                        ? new Date(payment.cashedAt).toLocaleDateString(locale)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
