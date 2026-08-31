import { Breadcrumbs, Card, type Column, DataTable, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { userGateway } from '@/gateways/user-gateway'
import { formatDate } from '@/lib/date'
import { requirePlatformAdmin } from '../../_lib/auth-helper'
import { platformPageMetadata } from '../../_lib/page-metadata'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return platformPageMetadata(locale, 'dashboard.pages.superAdmins.title')
}

export default async function SuperAdminsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.superAdmins')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  await requirePlatformAdmin()

  const superAdmins = await userGateway.listSuperAdmins()
  const activeCount = superAdmins.filter((user) => user.isActive).length

  const columns: Column<(typeof superAdmins)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (user) => (
        <div>
          <p className="font-medium text-gray-900">
            {user.name || <span className="text-gray-300">&mdash;</span>}
          </p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'schools',
      header: t('schools'),
      className: 'text-gray-700',
      render: (user) =>
        user.schoolMemberships.length > 0 ? (
          user.schoolMemberships.map((membership) => membership.school.name).join(', ')
        ) : (
          <span className="text-gray-400">{t('allSchools')}</span>
        ),
    },
    {
      key: 'lastLogin',
      header: t('lastLogin'),
      className: 'text-gray-700',
      render: (user) =>
        user.sessions[0] ? (
          formatDate(user.sessions[0].createdAt, locale)
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: 'createdAt',
      header: t('createdAt'),
      className: 'text-gray-700',
      render: (user) => formatDate(user.createdAt, locale),
    },
    {
      key: 'status',
      header: t('status'),
      render: (user) => (
        <StatusBadge
          status={user.isActive ? 'green' : 'gray'}
          label={user.isActive ? t('active') : t('inactive')}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('superAdmins') },
        ]}
      />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('description', { count: activeCount })}</p>
      </div>

      <Card className="rounded border border-gray-200">
        <DataTable
          data={superAdmins}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage={t('noSuperAdmins')}
        />
      </Card>
    </div>
  )
}
