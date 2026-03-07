import { Card, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { AddPersonDialog } from '../_components/add-person-dialog'
import { AddPhoneDialog } from '../_components/add-phone-dialog'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { PaymentSummary } from '../_components/payment-summary'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const family = await db.family.findUnique({ where: { id } })
  const t = await getTranslations({ locale, namespace: 'dashboard.pages.familyDetails' })

  return {
    title: family?.name || t('title'),
  }
}

export default async function FamilyDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.familyDetails')

  const { roles, familyId } = await getSessionWithRole()

  if (!roles.includes('admin') && familyId !== id) notFound()

  const family = await db.family.findUnique({
    where: { id },
    include: {
      persons: {
        where: { person: { isActive: true } },
        include: {
          person: {
            include: {
              student: {
                where: { isActive: true },
                include: {
                  enrollments: {
                    where: { isActive: true },
                    include: {
                      plan: true,
                      classAssignments: {
                        where: { endAt: null },
                        include: {
                          classPeriod: true,
                        },
                      },
                    },
                  },
                },
              },
              phoneNumbers: {
                where: { isActive: true },
              },
            },
          },
        },
      },
      payments: {
        where: { isActive: true },
        include: {
          enrollment: {
            include: {
              student: {
                include: { person: true },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' as const },
      },
    },
  })

  if (!family) notFound()

  const students = family.persons.filter((fp) => fp.person.student)

  const allEnrollments = students.flatMap((s) => s.person.student?.enrollments ?? [])
  const totalDue = allEnrollments.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const totalDiscount = allEnrollments.reduce((sum, e) => sum + Number(e.discount), 0)
  const totalPaid = family.payments.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        </div>
        {roles.includes('admin') && (
          <div className="flex gap-2">
            <EditFamilyDialog family={family} />
            <DeactivateFamilyButton familyId={family.id} />
          </div>
        )}
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{t('emergencyContact')}</h3>
          <p className="mt-1 text-sm text-gray-900">{family.emergencyContact || '-'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{t('authorizedPickup')}</h3>
          <p className="mt-1 text-sm text-gray-900">{family.authorizedPickup || '-'}</p>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('familyMembers')}</h2>
          {roles.includes('admin') && <AddPersonDialog familyId={family.id} />}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('table.name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('table.relationType')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('table.email')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('table.phone')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {family.persons.map((fp) => (
                <tr key={fp.personId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {fp.person.name} {fp.person.lastname}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{fp.relationType}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{fp.person.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>{fp.person.phoneNumbers[0]?.phoneNumber || '-'}</span>
                      {roles.includes('admin') && <AddPhoneDialog personId={fp.personId} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {students.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('students')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('studentTable.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('studentTable.birthday')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('studentTable.birthplace')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('studentTable.allergies')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => {
                  const s = student.person.student
                  if (!s) return null
                  return (
                    <tr key={student.person.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {student.person.name} {student.person.lastname}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(s.birthday).toLocaleDateString(locale)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.birthplace || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.allergies || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {students.some((s) => (s.person.student?.enrollments.length ?? 0) > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('enrollments')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.student')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.plan')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.total')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.flatMap((student) =>
                  (student.person.student?.enrollments ?? []).map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {student.person.name} {student.person.lastname}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{enrollment.plan.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        €{formatAmount(enrollment.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allEnrollments.length > 0 && (
        <PaymentSummary totalDue={totalDue} totalDiscount={totalDiscount} totalPaid={totalPaid} />
      )}

      {family.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('paymentHistory.title')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.student')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.amount')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.method')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.reference')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.paidAt')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('paymentHistory.cashedAt')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {family.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {payment.enrollment.student.person.name}{' '}
                      {payment.enrollment.student.person.lastname}
                    </td>
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
