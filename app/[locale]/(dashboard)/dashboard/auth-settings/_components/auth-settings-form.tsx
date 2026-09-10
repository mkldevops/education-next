'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import {
  setGoogleSignInEnabledAction,
  setPasskeySignInEnabledAction,
} from '../../../_lib/platform-settings-actions'

type ToggleProps = {
  title: string
  description: string
  hint?: string
  enabled: boolean
  onSave: (enabled: boolean) => Promise<string>
}

/**
 * La case reflète l'état optimiste et revient en arrière si l'écriture est refusée : le
 * réglage gouverne toute l'instance, afficher un état non enregistré serait pire que
 * l'attente.
 */
function AuthMethodToggle({ title, description, hint, enabled, onSave }: ToggleProps) {
  const t = useTranslations('dashboard.pages.authSettings')
  const router = useRouter()
  const inputId = useId()
  const [checked, setChecked] = useState(enabled)
  const [pending, startTransition] = useTransition()

  const onToggle = (next: boolean) => {
    setChecked(next)
    startTransition(async () => {
      const result = await onSave(next)
      if (result !== 'OK') {
        setChecked(!next)
        toast.error(t('error'))
        return
      }
      router.refresh()
    })
  }

  return (
    <Card className="rounded border border-alabaster-700 p-6">
      <h2 className="text-lg font-semibold text-graphite">{title}</h2>
      <p className="mt-1 text-sm text-graphite-600">{description}</p>
      {hint && <p className="mt-2 text-sm text-orange-600">{hint}</p>}
      <label htmlFor={inputId} className="mt-4 flex items-center gap-2 text-sm text-graphite">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-4 w-4 rounded border-alabaster"
        />
        {checked ? t('enabled') : t('disabled')}
      </label>
    </Card>
  )
}

type Props = {
  googleEnabled: boolean
  googleConfigured: boolean
  passkeyEnabled: boolean
}

export function AuthSettingsForm({ googleEnabled, googleConfigured, passkeyEnabled }: Props) {
  const t = useTranslations('dashboard.pages.authSettings')

  return (
    <div className="space-y-6">
      <AuthMethodToggle
        title={t('google.title')}
        description={t('google.description')}
        hint={googleConfigured ? undefined : t('google.notConfigured')}
        enabled={googleEnabled}
        onSave={setGoogleSignInEnabledAction}
      />
      <AuthMethodToggle
        title={t('passkey.title')}
        description={t('passkey.description')}
        enabled={passkeyEnabled}
        onSave={setPasskeySignInEnabledAction}
      />
    </div>
  )
}
