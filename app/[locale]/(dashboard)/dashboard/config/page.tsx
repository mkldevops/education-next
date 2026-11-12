import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readsAsEnabled } from '@/domain/feature-flags'
import { absenceReasonGateway } from '@/gateways/absence-reason-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { formatDateTime } from '@/lib/date'
import { db } from '@/lib/db'
import { PAYMENTS_ENABLED_CONFIG_KEY } from '@/lib/payment-config'
import { SCHOOL_CONFIG_KEYS, SCHOOL_CONFIG_VALUE_TYPES } from '@/lib/school-config'
import { SCHOOL_CONFIG_DEFAULTS } from '@/lib/school-config-defaults'
import { isSecretEncryptionConfigured } from '@/lib/secret-crypto'
import { isGoogleConfigured } from '@/lib/social-providers'
import { stripeWebhookPath } from '@/lib/stripe-config'
import { getStripeSettings } from '@/use-cases/payments/stripe-settings'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { describeOpenRouterKey } from '@/use-cases/platform-settings/openrouter-api-key'
import { getSchoolCurrencySettings } from '@/use-cases/schools/school-currency'
import { countGoogleOnlyAccounts } from '@/use-cases/users/count-google-only-accounts'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { PaymentsModule } from './_components/payments-module'
import { PlatformSettingsPanel } from './_components/platform-settings-panel'
import { SchoolIdentityCard } from './_components/school-identity-card'
import { SchoolModulesGrid } from './_components/school-modules-grid'
import type { SchoolSetting } from './_components/school-setting'

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
    openRouterKey,
    schoolSwitchEnabled,
    googleOnlyAccountCount,
  ] = isSuperAdmin
    ? await Promise.all([
        isGoogleSignInEnabled(),
        isPasskeySignInEnabled(),
        isMcpEnabled(),
        isAiAssistantEnabled(),
        describeOpenRouterKey(),
        isSchoolSwitchEnabled(),
        countGoogleOnlyAccounts(),
      ])
    : [
        false,
        false,
        false,
        false,
        { status: 'notConfigured' as const, hint: null, savedAt: null },
        false,
        0,
      ]

  const t = await getTranslations('dashboard.pages.config')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  // Les deux comptages ne servent qu'aux confirmations de coupure, mais partent avec la
  // lecture des réglages : un aller-retour séquentiel pour un nombre affiché serait gratuit.
  const [
    dbConfigs,
    paymentFootprint,
    teacherExpenseCount,
    stripeSettings,
    currencySettings,
    absenceReasons,
  ] = await Promise.all([
    db.config.findMany({
      where: { schoolId, isActive: true, name: { in: SCHOOL_CONFIG_KEYS } },
      select: { name: true, value: true },
    }),
    paymentGateway.countFootprint(schoolId),
    teacherGateway.countExpenses(schoolId),
    getStripeSettings(schoolId),
    getSchoolCurrencySettings(schoolId),
    absenceReasonGateway.listActive(schoolId),
  ])
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550').replace(/\/$/, '')
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

      <section className="space-y-3">
        <SectionHeading
          title={t('sections.identity')}
          description={t('sections.identityDescription')}
        />
        <SchoolIdentityCard settings={settings} />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title={t('sections.modules')}
          description={t('sections.modulesDescription')}
        />
        <SchoolModulesGrid
          settings={settings}
          absenceReasons={absenceReasons.map(({ id, label, justified }) => ({
            id,
            label,
            justified,
          }))}
          teacherExpenseCount={teacherExpenseCount}
          payments={
            <PaymentsModule
              paymentsEnabled={readsAsEnabled(storedValues.get(PAYMENTS_ENABLED_CONFIG_KEY))}
              paymentFootprint={paymentFootprint}
              settings={stripeSettings}
              currency={currencySettings}
              webhookUrl={`${appUrl}${stripeWebhookPath(schoolId)}`}
              secretStorageConfigured={isSecretEncryptionConfigured()}
            />
          }
        />
      </section>

      {isSuperAdmin && (
        <PlatformSettingsPanel
          googleEnabled={googleEnabled}
          googleConfigured={isGoogleConfigured}
          passkeyEnabled={passkeyEnabled}
          mcpEnabled={mcpEnabled}
          aiAssistantEnabled={aiAssistantEnabled}
          openRouterKey={{
            ...openRouterKey,
            savedAt: openRouterKey.savedAt ? formatDateTime(openRouterKey.savedAt, locale) : null,
          }}
          secretStorageConfigured={isSecretEncryptionConfigured()}
          schoolSwitchEnabled={schoolSwitchEnabled}
          googleOnlyAccountCount={googleOnlyAccountCount}
        />
      )}
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-graphite">{title}</h2>
      <p className="mt-1 text-sm text-graphite-600">{description}</p>
    </div>
  )
}
