import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.students.title'),
  }
}

export default async function StudentsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.students')

  const { roles, familyId } = await getSessionWithRole()

  const whereFamilies = roles.includes('admin') ? undefined : { some: { familyId } }

  const students = await db.student.findMany({
    where: {
      isActive: true,
      ...(whereFamilies && { person: { families: whereFamilies } }),
    },
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
      enrollments: {
        where: { status: { in: ['PENDING', 'ACTIVE'] } },
        include: {
          classAssignments: {
            where: { endAt: null },
            include: {
              classPeriod: true,
            },
          },
        },
      },
    },
    orderBy: { person: { lastname: 'asc' } },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {students.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noStudents')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('birthday')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('family')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('class')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((student) => {
                const familyName =
                  student.person.families.length > 0 ? student.person.families[0].family.name : '-'
                const currentClass =
                  student.enrollments.length > 0 &&
                  student.enrollments[0].classAssignments.length > 0
                    ? student.enrollments[0].classAssignments[0].classPeriod.name
                    : '-'

                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {student.person.name} {student.person.lastname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(student.birthday).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{familyName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{currentClass}</td>
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
