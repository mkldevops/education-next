import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { StudentsDataTable } from './_components/students-data-table'

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
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.students')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()

  const isAdmin = scope.isAdmin
  const whereFamilies = scope.isAdmin ? undefined : { some: { familyId: scope.familyId } }

  const students = await db.student.findMany({
    where: {
      schoolId: scope.schoolId,
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
        select: {
          classAssignments: {
            where: { endAt: null },
            select: {
              classPeriod: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { person: { lastname: 'asc' } },
  })

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('students') },
        ]}
      />
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <Card className="rounded-xl border border-gray-200 p-4">
        <StudentsDataTable data={students} locale={locale} isAdmin={isAdmin} />
      </Card>
    </div>
  )
}
