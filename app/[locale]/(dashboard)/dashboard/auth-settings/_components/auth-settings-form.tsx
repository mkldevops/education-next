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
}

export function AuthSettingsForm({ googleEnabled, googleConfigured, passkeyEnabled }: Props) {
  const t = useTranslations('dashboard.pages.authSettings')

  return (
    <div className="space-y-6">
      <PlatformFlagToggle
        title={t('google.title')}
        description={t('google.description')}
        hint={googleConfigured ? undefined : t('google.notConfigured')}
        enabled={googleEnabled}
        onSave={setGoogleSignInEnabledAction}
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
