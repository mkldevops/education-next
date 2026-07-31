import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link, redirect } from '@/i18n/routing'
import { db } from '@/lib/db'
import { requireFamilyScope } from '../../_lib/auth-helper'
import { CreateFamilyDialog } from './_components/create-family-dialog'

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

  const scope = await requireFamilyScope()

  if (!scope.isAdmin) {
    redirect({ href: `/dashboard/families/${scope.familyId}`, locale })
  }

  const isAdmin = scope.isAdmin

  const families = await db.family.findMany({
    where: { isActive: true },
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

  const columns: Column<(typeof familiesWithCounts)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (family) => (
        <Link
          href={`/dashboard/families/${family.id}`}
          className="font-medium text-primary hover:text-primary-hover"
        >
          {family.name}
        </Link>
      ),
    },
    {
      key: 'emergencyContact',
      header: t('emergencyContact'),
      className: 'text-gray-700',
      render: (family) => family.emergencyContact || '-',
    },
    {
      key: 'studentCount',
      header: t('students'),
      className: 'text-gray-700',
      render: (family) => family.studentCount,
    },
    {
      key: 'enrollmentCount',
      header: t('enrollments'),
      className: 'text-gray-700',
      render: (family) => family.enrollmentCount,
    },
  ]

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
      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={familiesWithCounts}
          columns={columns}
          getRowKey={(family) => family.id}
          emptyMessage={t('noFamilies')}
        />
      </Card>
    </div>
  )
}
