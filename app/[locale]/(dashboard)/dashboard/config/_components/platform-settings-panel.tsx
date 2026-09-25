'use client'

import { useTranslations } from 'next-intl'
import { FlagToggle } from '../../../_components/flag-toggle'
import {
  setAiAssistantEnabledAction,
  setGoogleSignInEnabledAction,
  setMcpEnabledAction,
  setPasskeySignInEnabledAction,
  setSchoolSwitchEnabledAction,
} from '../../../_lib/platform-settings-actions'
import { OpenRouterKeyForm, type OpenRouterKeyStatus } from './openrouter-key-form'
import { SettingsSection } from './settings-section'

type Props = {
  googleEnabled: boolean
  googleConfigured: boolean
  passkeyEnabled: boolean
  mcpEnabled: boolean
  aiAssistantEnabled: boolean
  openRouterKeyStatus: OpenRouterKeyStatus
  secretStorageConfigured: boolean
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
  aiAssistantEnabled,
  openRouterKeyStatus,
  secretStorageConfigured,
  schoolSwitchEnabled,
  googleOnlyAccountCount,
}: Props) {
  const t = useTranslations('dashboard.pages.config')
  const tAuth = useTranslations('dashboard.pages.authSettings')
  const tIntegrations = useTranslations('dashboard.pages.integrations')
  const tSwitch = useTranslations('schools.admin.platformSwitch')

  return (
    <>
      <SettingsSection title={tAuth('title')} description={tAuth('description')}>
        <FlagToggle
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
        <FlagToggle
          title={tAuth('passkey.title')}
          description={tAuth('passkey.description')}
          enabled={passkeyEnabled}
          onSave={setPasskeySignInEnabledAction}
        />
      </SettingsSection>

      <SettingsSection title={t('sections.schools')} description={t('sections.schoolsDescription')}>
        <FlagToggle
          title={tSwitch('title')}
          description={tSwitch('description')}
          enabled={schoolSwitchEnabled}
          onSave={setSchoolSwitchEnabledAction}
        />
      </SettingsSection>

      <SettingsSection title={tIntegrations('title')} description={tIntegrations('description')}>
        <FlagToggle
          title={tIntegrations('mcp.title')}
          description={tIntegrations('mcp.description')}
          hint={tIntegrations('mcp.hint')}
          enabled={mcpEnabled}
          onSave={setMcpEnabledAction}
        />
        <FlagToggle
          title={tIntegrations('aiAssistant.title')}
          description={tIntegrations('aiAssistant.description')}
          hint={
            openRouterKeyStatus === 'configured'
              ? tIntegrations('aiAssistant.hint')
              : openRouterKeyStatus === 'unreadable'
                ? tIntegrations('aiAssistant.unreadable')
                : tIntegrations('aiAssistant.notConfigured')
          }
          enabled={aiAssistantEnabled}
          onSave={setAiAssistantEnabledAction}
        />
        <OpenRouterKeyForm
          status={openRouterKeyStatus}
          secretStorageConfigured={secretStorageConfigured}
        />
      </SettingsSection>
    </>
  )
}
