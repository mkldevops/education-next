import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ConfigValueTypeLabel } from '@/features/enums'
import { BRANDING_CONFIG_DEFAULTS, BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import { db } from '@/lib/db'
import {
  TEACHER_EXPENSES_CONFIG_DEFAULT,
  TEACHER_EXPENSES_CONFIG_KEY,
} from '@/lib/teacher-expense-config'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateConfigDialog } from './_components/create-config-dialog'
import { EditConfigDialog } from './_components/edit-config-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

// automatic_promotion drives no feature (the promotion use case has no UI trigger), so it is
// hidden from the admin page instead of exposing a setting that has no effect.
const HIDDEN_CONFIG_NAMES = new Set(['automatic_promotion'])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.config.title')
}

export default async function ConfigPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()

  const t = await getTranslations('dashboard.pages.config')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const dbConfigs = await db.config.findMany({
    where: { schoolId, isActive: true },
    orderBy: { name: 'asc' },
  })

  const configuredNames = new Set(dbConfigs.map((config) => config.name))
  const missingKnownConfigs = [...BRANDING_CONFIG_DEFAULTS, TEACHER_EXPENSES_CONFIG_DEFAULT]
    .filter((config) => !configuredNames.has(config.name))
    .map((config) => ({
      ...config,
      id: `default-${config.name}`,
      schoolId,
      isActive: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }))
  const configs = [...dbConfigs, ...missingKnownConfigs]
    .filter((config) => !HIDDEN_CONFIG_NAMES.has(config.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  const knownConfig: Record<string, { label: string; description?: string }> = {
    [BRANDING_CONFIG_KEYS.logoUrl]: { label: t('known.logo') },
    [BRANDING_CONFIG_KEYS.faviconUrl]: { label: t('known.favicon') },
    max_students_per_class: {
      label: t('known.maxStudentsPerClass'),
      description: t('descriptions.maxStudentsPerClass'),
    },
    [TEACHER_EXPENSES_CONFIG_KEY]: {
      label: t('known.teacherExpenses'),
      description: t('descriptions.teacherExpenses'),
    },
  }

  const columns: Array<Column<(typeof configs)[0]>> = [
    {
      key: 'name',
      header: t('name'),
      className: 'font-medium text-gray-900',
      render: (config): ReactNode => {
        const known = knownConfig[config.name]

        if (!known) return config.name

        return (
          <div className="space-y-1">
            <span>{known.label}</span>
            <div className="text-xs font-normal text-gray-500">{config.name}</div>
            {known.description && (
              <div className="text-xs font-normal text-gray-400">{known.description}</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'value',
      header: t('value'),
      className: 'text-gray-700 break-words',
      render: (config): ReactNode => {
        if (config.valueType === 'BOOLEAN') {
          return config.value === 'true' ? t('booleanTrue') : t('booleanFalse')
        }

        return config.value ? (
          <div className="flex min-w-0 items-center gap-3">
            {(config.name === BRANDING_CONFIG_KEYS.logoUrl ||
              config.name === BRANDING_CONFIG_KEYS.faviconUrl) && (
              // biome-ignore lint/performance/noImgElement: config URLs are dynamic
              <img
                src={config.value}
                alt=""
                className="size-8 shrink-0 rounded border border-gray-200 object-contain"
              />
            )}
            <span className="min-w-0 break-all">{config.value}</span>
          </div>
        ) : (
          <span className="text-gray-400">{t('notConfigured')}</span>
        )
      },
    },
    {
      key: 'valueType',
      header: t('type'),
      className: 'text-gray-700',
      render: (config): ReactNode => (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
          <ConfigValueTypeLabel valueType={config.valueType} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (config): ReactNode => (
        <EditConfigDialog
          config={{
            name: config.name,
            value: config.value,
            valueType: config.valueType,
          }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('config') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreateConfigDialog />
      </div>
      <Card className="rounded border border-gray-200">
        <DataTable
          data={configs}
          columns={columns}
          getRowKey={(config) => config.id}
          emptyMessage={t('noConfig')}
        />
      </Card>
    </div>
  )
}
