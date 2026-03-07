import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreateFamilyDialog } from './_components/create-family-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.families.title'),
  }
}

export default async function FamiliesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.families')

  const { roles, familyId } = await getSessionWithRole()

  const whereClause = roles.includes('admin')
    ? { isActive: true }
    : { isActive: true, id: familyId }

  const families = await db.family.findMany({
    where: whereClause,
    include: {
      persons: {
        include: {
          person: {
            include: {
              student: {
                include: {
                  enrollments: {
                    where: { status: { in: ['PENDING', 'ACTIVE'] } },
                  },
                },
              },
              phoneNumbers: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const familiesWithCounts = families.map((family) => {
    const students = family.persons.filter((fp) => fp.person.student).length
    const enrollments = family.persons.reduce((sum, fp) => {
      return sum + (fp.person.student?.enrollments.length || 0)
    }, 0)

    return {
      ...family,
      studentCount: students,
      enrollmentCount: enrollments,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreateFamilyDialog />
      </div>

      {familiesWithCounts.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noFamilies')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('emergencyContact')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('students')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('enrollments')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {familiesWithCounts.map((family) => (
                <tr key={family.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/dashboard/families/${family.id}`}
                      className="text-primary hover:text-primary-hover font-medium"
                    >
                      {family.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {family.emergencyContact || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{family.studentCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{family.enrollmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
