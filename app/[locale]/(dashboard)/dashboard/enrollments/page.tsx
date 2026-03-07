import { StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreateEnrollmentDialog } from './_components/create-enrollment-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.enrollments.title'),
  }
}

export default async function EnrollmentsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollments')

  const { roles, familyId } = await getSessionWithRole()

  const whereStudent = roles.includes('admin')
    ? {}
    : {
        person: {
          families: {
            some: { familyId },
          },
        },
      }

  const [students, plans, classes] = roles.includes('admin')
    ? await Promise.all([
        db.student.findMany({
          where: { isActive: true },
          include: { person: true },
          orderBy: { person: { lastname: 'asc' } },
        }),
        db.plan.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        db.classPeriod.findMany({
          where: { isActive: true },
          include: { level: true, period: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], [], []]

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.person.lastname} ${s.person.name}`,
  }))
  const planOptions = plans.map((p) => ({ id: p.id, name: p.name }))
  const classOptions = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.level.name} — ${c.period.name})`,
  }))

  const enrollments = await db.enrollment.findMany({
    where: { isActive: true, student: whereStudent },
    include: {
      student: {
        include: {
          person: true,
        },
      },
      plan: true,
      classAssignments: {
        where: { endAt: null },
        include: {
          classPeriod: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {studentOptions.length > 0 && planOptions.length > 0 && classOptions.length > 0 && (
          <CreateEnrollmentDialog
            students={studentOptions}
            plans={planOptions}
            classes={classOptions}
          />
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noEnrollments')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('student')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('plan')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('class')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('totalAmount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((enrollment) => {
                const className =
                  enrollment.classAssignments.length > 0
                    ? enrollment.classAssignments[0].classPeriod.name
                    : '-'

                return (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/dashboard/enrollments/${enrollment.id}`}
                        className="text-primary hover:text-primary-hover font-medium"
                      >
                        {enrollment.student.person.name} {enrollment.student.person.lastname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{enrollment.plan.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={enrollment.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{className}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      €{formatAmount(enrollment.totalAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
