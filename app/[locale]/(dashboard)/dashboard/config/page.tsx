import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ConfigValueTypeLabel } from '@/features/enums'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import { db } from '@/lib/db'
import {
  MAX_STUDENTS_PER_CLASS_CONFIG_KEY,
  SCHOOL_CONFIG_DEFAULTS,
  THEME_PRIMARY_CONFIG_KEY,
} from '@/lib/school-config-defaults'
import { isGoogleConfigured } from '@/lib/social-providers'
import { TEACHER_EXPENSES_CONFIG_KEY } from '@/lib/teacher-expense-config'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreateConfigDialog } from './_components/create-config-dialog'
import { EditConfigDialog } from './_components/edit-config-dialog'
import { PlatformSettingsPanel } from './_components/platform-settings-panel'

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

  const { schoolId, isSuperAdmin } = await requireSchoolAdmin()

  // Les réglages plateforme ne sont lus que pour un super-admin : la page reste ouverte
  // à un ADMIN d'école, qui n'en voit que la table de configuration de son école.
  const platformSettings = isSuperAdmin
    ? await Promise.all([
        isGoogleSignInEnabled(),
        isPasskeySignInEnabled(),
        isMcpEnabled(),
        isSchoolSwitchEnabled(),
      ])
    : null

  const t = await getTranslations('dashboard.pages.config')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const dbConfigs = await db.config.findMany({
    where: { schoolId, isActive: true },
    orderBy: { name: 'asc' },
  })

  const configuredNames = new Set(dbConfigs.map((config) => config.name))
  // Repli pour les écoles antérieures au backfill : la liste reste la même qu'à la création.
  const missingKnownConfigs = SCHOOL_CONFIG_DEFAULTS.filter(
    (config) => !configuredNames.has(config.name)
  ).map((config) => ({
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
    [MAX_STUDENTS_PER_CLASS_CONFIG_KEY]: {
      label: t('known.maxStudentsPerClass'),
      description: t('descriptions.maxStudentsPerClass'),
    },
    [THEME_PRIMARY_CONFIG_KEY]: {
      label: t('known.themePrimary'),
      description: t('descriptions.themePrimary'),
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
      className: 'font-medium text-graphite',
      render: (config): ReactNode => {
        const known = knownConfig[config.name]

        if (!known) return config.name

        return (
          <div className="space-y-1">
            <span>{known.label}</span>
            <div className="text-xs font-normal text-graphite-600">{config.name}</div>
            {known.description && (
              <div className="text-xs font-normal text-graphite-600">{known.description}</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'value',
      header: t('value'),
      className: 'text-graphite break-words',
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
                className="size-8 shrink-0 rounded border border-alabaster-700 object-contain"
              />
            )}
            <span className="min-w-0 break-all">{config.value}</span>
          </div>
        ) : (
          <span className="text-graphite-600">{t('notConfigured')}</span>
        )
      },
    },
    {
      key: 'valueType',
      header: t('type'),
      className: 'text-graphite',
      render: (config): ReactNode => (
        <span className="inline-flex rounded-full bg-alabaster-800 px-2 py-1 text-xs font-medium text-graphite">
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
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('config') },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-graphite">{t('sections.school')}</h2>
            <p className="mt-1 text-sm text-graphite-600">{t('sections.schoolDescription')}</p>
          </div>
          <CreateConfigDialog />
        </div>
        <Card className="rounded border border-alabaster-700">
          <DataTable
            data={configs}
            columns={columns}
            getRowKey={(config) => config.id}
            emptyMessage={t('noConfig')}
          />
        </Card>
      </section>

      {platformSettings && (
        <PlatformSettingsPanel
          googleEnabled={platformSettings[0]}
          googleConfigured={isGoogleConfigured}
          passkeyEnabled={platformSettings[1]}
          mcpEnabled={platformSettings[2]}
          schoolSwitchEnabled={platformSettings[3]}
        />
      )}
    </div>
  )
}
