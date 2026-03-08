import { Breadcrumbs, Card, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { DeactivateStudentButton } from '../_components/deactivate-student-button'
import { EditStudentDialog } from '../_components/edit-student-dialog'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const student = await db.student.findUnique({
    where: { id },
    include: { person: true },
  })

  return {
    title: student ? `${student.person.name} ${student.person.lastname}` : 'Élève',
  }
}

export default async function StudentDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.studentDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const student = await db.student.findUnique({
    where: { id },
    include: {
      person: {
        include: {
          families: {
            include: {
              family: true,
            },
          },
          phoneNumbers: true,
        },
      },
      enrollments: {
        where: { isActive: true },
        include: {
          plan: true,
          classAssignments: {
            include: {
              classPeriod: {
                include: {
                  period: true,
                  level: true,
                },
              },
            },
          },
          payments: true,
        },
        orderBy: { registeredAt: 'desc' },
      },
    },
  })

  if (!student) notFound()

  if (!isAdmin) {
    const studentFamily = student.person.families.some((fp) => fp.familyId === familyId)
    if (!studentFamily) notFound()
  }

  const languagesAtHome = Array.isArray(student.languagesAtHome)
    ? student.languagesAtHome.join(', ')
    : '-'

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          {
            label: tBreadcrumbs('dashboard'),
            href: '/dashboard',
            icon: 'home',
          },
          { label: tBreadcrumbs('students'), href: '/dashboard/students' },
          { label: `${student.person.name} ${student.person.lastname}` },
        ]}
      />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {student.person.name} {student.person.lastname}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <EditStudentDialog student={student} />
            <DeactivateStudentButton studentId={student.id} />
          </div>
        )}
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('birthday')}</h3>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(student.birthday).toLocaleDateString(locale)}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('birthplace')}</h3>
            <p className="mt-1 text-sm text-gray-900">{student.birthplace || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('email')}</h3>
            <p className="mt-1 text-sm text-gray-900">{student.person.email || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('address')}</h3>
            <p className="mt-1 text-sm text-gray-900">{student.person.address || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('allergies')}</h3>
            <p className="mt-1 text-sm text-gray-900">{student.allergies || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">{t('languagesAtHome')}</h3>
            <p className="mt-1 text-sm text-gray-900">{languagesAtHome}</p>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{t('healthNotes')}</h3>
          <p className="mt-1 text-sm text-gray-900">{student.healthNotes || '-'}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{t('family')}</h3>
          <p className="mt-1 text-sm text-gray-900">
            {student.person.families.length > 0 ? student.person.families[0].family.name : '-'}
          </p>
        </div>
      </Card>

      {student.enrollments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('enrollments')}</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-150">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.plan')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.class')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.total')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('enrollmentTable.registered')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {student.enrollments.map((enrollment) => {
                  const className =
                    enrollment.classAssignments.length > 0
                      ? enrollment.classAssignments[0].classPeriod.name
                      : '-'

                  return (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{enrollment.plan.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={enrollment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{className}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        €{formatAmount(enrollment.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
