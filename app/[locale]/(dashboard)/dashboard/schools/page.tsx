import { Breadcrumbs, Card, type Column, DataTable, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { requirePlatformAdmin } from '../../_lib/auth-helper'
import { platformPageMetadata } from '../../_lib/page-metadata'
import { CreateSchoolDialog } from './_components/create-school-dialog'
import { EditSchoolDialog } from './_components/edit-school-dialog'
import { SchoolSwitchToggle } from './_components/school-switch-toggle'

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

  const [schools, switchEnabled] = await Promise.all([
    schoolGateway.listAll(),
    isSchoolSwitchEnabled(),
  ])
  const activeCount = schools.filter((school) => school.isActive).length

  const columns: Column<(typeof schools)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (school) => (
        <div>
          <p className="font-medium text-graphite">{school.name}</p>
          <p className="text-xs text-graphite-600">{school.slug}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: t('city'),
      className: 'text-graphite',
      render: (school) => school.city || <span className="text-graphite-800">&mdash;</span>,
    },
    {
      key: 'members',
      header: t('members'),
      className: 'text-graphite',
      render: (school) => school._count.members,
    },
    {
      key: 'families',
      header: t('families'),
      className: 'text-graphite',
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
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <CreateSchoolDialog />
      </div>

      <SchoolSwitchToggle enabled={switchEnabled} />

      <Card className="rounded border border-alabaster-700">
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
