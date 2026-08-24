import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { db } from '@/lib/db'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { CreateFamilyDialog } from './_components/create-family-dialog'
import { FamiliesDataTable, type FamilyRow } from './_components/families-data-table'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.families.title'),
  }
}

export default async function FamiliesPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.families')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()

  if (!scope.isAdmin) {
    redirect({ href: `/dashboard/families/${scope.familyId}`, locale })
  }

  const isAdmin = scope.isAdmin

  const families = await db.family.findMany({
    where: { schoolId: scope.schoolId, isActive: true },
    select: {
      id: true,
      name: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      persons: {
        select: {
          person: {
            select: {
              student: {
                select: {
                  enrollments: {
                    where: { status: { in: ['PENDING', 'ACTIVE'] } },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const familyRows: FamilyRow[] = families.map((family) => ({
    id: family.id,
    name: family.name,
    emergencyContactName: family.emergencyContactName,
    emergencyContactPhone: family.emergencyContactPhone,
    studentCount: family.persons.filter((fp) => fp.person.student).length,
    enrollmentCount: family.persons.reduce(
      (sum, fp) => sum + (fp.person.student?.enrollments.length ?? 0),
      0
    ),
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('families') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {isAdmin && <CreateFamilyDialog defaultOpen={action === 'create'} />}
      </div>
      <Card className="rounded-xl border border-gray-200 p-4">
        <FamiliesDataTable data={familyRows} />
      </Card>
    </div>
  )
}
