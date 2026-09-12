'use client'

import { useTranslations } from 'next-intl'
import { PlatformFlagToggle } from '../../../_components/platform-flag-toggle'
import {
  setGoogleSignInEnabledAction,
  setPasskeySignInEnabledAction,
} from '../../../_lib/platform-settings-actions'

type Props = {
  googleEnabled: boolean
  googleConfigured: boolean
  passkeyEnabled: boolean
  googleOnlyAccountCount: number
}

export function AuthSettingsForm({
  googleEnabled,
  googleConfigured,
  passkeyEnabled,
  googleOnlyAccountCount,
}: Props) {
  const t = useTranslations('dashboard.pages.authSettings')

  return (
    <div className="space-y-6">
      <PlatformFlagToggle
        title={t('google.title')}
        description={t('google.description')}
        hint={googleConfigured ? undefined : t('google.notConfigured')}
        enabled={googleEnabled}
        onSave={setGoogleSignInEnabledAction}
        confirmDisable={
          googleOnlyAccountCount > 0
            ? {
                title: t('google.confirmDisable.title'),
                description: t('google.confirmDisable.description', {
                  count: googleOnlyAccountCount,
                }),
                confirmLabel: t('google.confirmDisable.confirm'),
                cancelLabel: t('google.confirmDisable.cancel'),
              }
            : undefined
        }
      />
      <PlatformFlagToggle
        title={t('passkey.title')}
        description={t('passkey.description')}
        enabled={passkeyEnabled}
        onSave={setPasskeySignInEnabledAction}
      />
    </div>
  )
}
