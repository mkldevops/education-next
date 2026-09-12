'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { PlatformFlagToggle } from '../../../_components/platform-flag-toggle'
import {
  setGoogleSignInEnabledAction,
  setMcpEnabledAction,
  setPasskeySignInEnabledAction,
  setSchoolSwitchEnabledAction,
} from '../../../_lib/platform-settings-actions'

type Props = {
  googleEnabled: boolean
  googleConfigured: boolean
  passkeyEnabled: boolean
  mcpEnabled: boolean
  schoolSwitchEnabled: boolean
  googleOnlyAccountCount: number
}

/**
 * Les réglages plateforme vivent sur la page Configuration : un administrateur n'a plus
 * qu'une seule surface de réglages, la portée reste lisible par le titre de section.
 */
export function PlatformSettingsPanel({
  googleEnabled,
  googleConfigured,
  passkeyEnabled,
  mcpEnabled,
  schoolSwitchEnabled,
  googleOnlyAccountCount,
}: Props) {
  const t = useTranslations('dashboard.pages.config')
  const tAuth = useTranslations('dashboard.pages.authSettings')
  const tIntegrations = useTranslations('dashboard.pages.integrations')
  const tSwitch = useTranslations('schools.admin.platformSwitch')

  return (
    <>
      <Section title={tAuth('title')} description={tAuth('description')}>
        <PlatformFlagToggle
          title={tAuth('google.title')}
          description={tAuth('google.description')}
          hint={googleConfigured ? undefined : tAuth('google.notConfigured')}
          enabled={googleEnabled}
          onSave={setGoogleSignInEnabledAction}
          confirmDisable={
            googleOnlyAccountCount > 0
              ? {
                  title: tAuth('google.confirmDisable.title'),
                  description: tAuth('google.confirmDisable.description', {
                    count: googleOnlyAccountCount,
                  }),
                  confirmLabel: tAuth('google.confirmDisable.confirm'),
                  cancelLabel: tAuth('google.confirmDisable.cancel'),
                }
              : undefined
          }
        />
        <PlatformFlagToggle
          title={tAuth('passkey.title')}
          description={tAuth('passkey.description')}
          enabled={passkeyEnabled}
          onSave={setPasskeySignInEnabledAction}
        />
      </Section>

      <Section title={t('sections.schools')} description={t('sections.schoolsDescription')}>
        <PlatformFlagToggle
          title={tSwitch('title')}
          description={tSwitch('description')}
          enabled={schoolSwitchEnabled}
          onSave={setSchoolSwitchEnabledAction}
        />
      </Section>

      <Section title={tIntegrations('title')} description={tIntegrations('description')}>
        <PlatformFlagToggle
          title={tIntegrations('mcp.title')}
          description={tIntegrations('mcp.description')}
          hint={tIntegrations('mcp.hint')}
          enabled={mcpEnabled}
          onSave={setMcpEnabledAction}
        />
      </Section>
    </>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-graphite">{title}</h2>
        <p className="mt-1 text-sm text-graphite-600">{description}</p>
      </div>
      <Card className="divide-y divide-alabaster-700 rounded border border-alabaster-700 p-0">
        {children}
      </Card>
    </section>
  )
}
