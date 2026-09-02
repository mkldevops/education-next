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
          <p className="font-medium text-graphite">
            {user.name || <span className="text-graphite-800">&mdash;</span>}
          </p>
          <p className="text-xs text-graphite-600">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'scope',
      header: t('scope'),
      render: (user) => (
        <div>
          <p className="text-graphite">{t('allSchools')}</p>
          {user.schoolMemberships.length > 0 && (
            <p className="text-xs text-graphite-700">
              {t('alsoMember', {
                schools: user.schoolMemberships
                  .map((membership) => membership.school.name)
                  .join(', '),
              })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: t('lastLogin'),
      className: 'text-graphite',
      render: (user) =>
        user.sessions[0] ? (
          formatDate(user.sessions[0].createdAt, locale)
        ) : (
          <span className="text-graphite-800">&mdash;</span>
        ),
    },
    {
      key: 'createdAt',
      header: t('createdAt'),
      className: 'text-graphite',
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
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="text-sm text-graphite-600">{t('description', { count: activeCount })}</p>
      </div>

      <Card className="rounded border border-alabaster-700">
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
