import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { paymentGateway } from '@/gateways/payment-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { db } from '@/lib/db'
import { SCHOOL_CONFIG_KEYS, SCHOOL_CONFIG_VALUE_TYPES } from '@/lib/school-config'
import { SCHOOL_CONFIG_DEFAULTS } from '@/lib/school-config-defaults'
import { isSecretEncryptionConfigured } from '@/lib/secret-crypto'
import { isGoogleConfigured } from '@/lib/social-providers'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { getOpenRouterKeyStatus } from '@/use-cases/platform-settings/openrouter-api-key'
import { countGoogleOnlyAccounts } from '@/use-cases/users/count-google-only-accounts'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { PlatformSettingsPanel } from './_components/platform-settings-panel'
import { type SchoolSetting, SchoolSettingsPanel } from './_components/school-settings-panel'

type Props = {
  params: Promise<{ locale: string }>
}

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
  // à un ADMIN d'école, qui n'en voit que les réglages de son école.
  const [
    googleEnabled,
    passkeyEnabled,
    mcpEnabled,
    aiAssistantEnabled,
    openRouterKeyStatus,
    schoolSwitchEnabled,
    googleOnlyAccountCount,
  ] = isSuperAdmin
    ? await Promise.all([
        isGoogleSignInEnabled(),
        isPasskeySignInEnabled(),
        isMcpEnabled(),
        isAiAssistantEnabled(),
        getOpenRouterKeyStatus(),
        isSchoolSwitchEnabled(),
        countGoogleOnlyAccounts(),
      ])
    : [false, false, false, false, 'notConfigured' as const, false, 0]

  const t = await getTranslations('dashboard.pages.config')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  // Les deux comptages ne servent qu'aux confirmations de coupure, mais partent avec la
  // lecture des réglages : un aller-retour séquentiel pour un nombre affiché serait gratuit.
  const [dbConfigs, paymentFootprint, teacherExpenseCount] = await Promise.all([
    db.config.findMany({
      where: { schoolId, isActive: true, name: { in: SCHOOL_CONFIG_KEYS } },
      select: { name: true, value: true },
    }),
    paymentGateway.countFootprint(schoolId),
    teacherGateway.countExpenses(schoolId),
  ])
  const storedValues = new Map(dbConfigs.map((config) => [config.name, config.value]))
  const defaultValues = new Map<string, string>(
    SCHOOL_CONFIG_DEFAULTS.map((config) => [config.name, config.value])
  )
  // Une ligne par clé connue : une école antérieure au backfill voit les mêmes réglages.
  const settings: SchoolSetting[] = SCHOOL_CONFIG_KEYS.map((name) => ({
    name,
    value: storedValues.get(name) ?? defaultValues.get(name) ?? '',
    valueType: SCHOOL_CONFIG_VALUE_TYPES[name],
  }))

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

      <SchoolSettingsPanel
        settings={settings}
        paymentFootprint={paymentFootprint}
        teacherExpenseCount={teacherExpenseCount}
      />

      {isSuperAdmin && (
        <PlatformSettingsPanel
          googleEnabled={googleEnabled}
          googleConfigured={isGoogleConfigured}
          passkeyEnabled={passkeyEnabled}
          mcpEnabled={mcpEnabled}
          aiAssistantEnabled={aiAssistantEnabled}
          openRouterKeyStatus={openRouterKeyStatus}
          secretStorageConfigured={isSecretEncryptionConfigured()}
          schoolSwitchEnabled={schoolSwitchEnabled}
          googleOnlyAccountCount={googleOnlyAccountCount}
        />
      )}
    </div>
  )
}
