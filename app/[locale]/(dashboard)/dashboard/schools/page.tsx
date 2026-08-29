import { Breadcrumbs, Card, type Column, DataTable, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { requirePlatformAdmin } from '../../_lib/auth-helper'
import { platformPageMetadata } from '../../_lib/page-metadata'
import { CreateSchoolDialog } from './_components/create-school-dialog'
import { EditSchoolDialog } from './_components/edit-school-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return platformPageMetadata(locale, 'schools.admin.title')
}

export default async function SchoolsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('schools.admin')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  await requirePlatformAdmin()

  const schools = await schoolGateway.listAll()
  const activeCount = schools.filter((school) => school.isActive).length

  const columns: Column<(typeof schools)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (school) => (
        <div>
          <p className="font-medium text-gray-900">{school.name}</p>
          <p className="text-xs text-gray-500">{school.slug}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: t('city'),
      className: 'text-gray-700',
      render: (school) => school.city || <span className="text-gray-300">&mdash;</span>,
    },
    {
      key: 'members',
      header: t('members'),
      className: 'text-gray-700',
      render: (school) => school._count.members,
    },
    {
      key: 'families',
      header: t('families'),
      className: 'text-gray-700',
      render: (school) => school._count.families,
    },
    {
      key: 'status',
      header: t('status'),
      render: (school) => (
        <StatusBadge
          status={school.isActive ? 'green' : 'gray'}
          label={school.isActive ? t('active') : t('inactive')}
        />
      ),
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (school) => (
        <EditSchoolDialog
          school={{
            id: school.id,
            name: school.name,
            slug: school.slug,
            address: school.address ?? '',
            postCode: school.postCode ?? '',
            city: school.city ?? '',
            isActive: school.isActive,
          }}
          isLastActive={school.isActive && activeCount <= 1}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('schools') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreateSchoolDialog />
      </div>

      <Card className="rounded border border-gray-200">
        <DataTable
          data={schools}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage={t('noSchools')}
        />
      </Card>
    </div>
  )
}
