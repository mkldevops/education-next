'use client'

import { Button } from '@peaklab/ui'
import { Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { StripeSecretKind } from '@/lib/stripe-config'
import { toast } from '@/lib/toast'
import type { StripeSettings } from '@/use-cases/payments/stripe-settings'
import { FlagToggle } from '../../../_components/flag-toggle'
import { setStripeEnabledAction } from '../../../_lib/stripe-settings-actions'
import { SettingsSection } from './settings-section'
import { StripeSecretForm } from './stripe-secret-form'

type Props = {
  settings: StripeSettings
  webhookUrl: string
  secretStorageConfigured: boolean
}

/**
 * Paiement en ligne de l'école active. L'interrupteur reste figé tant qu'aucun jeu
 * d'identifiants complet n'est lisible — ni celui de l'école, ni celui de l'instance —, et
 * n'affiche activé que ce que le bouton parent proposera réellement.
 */
export function StripeSettingsSection({ settings, webhookUrl, secretStorageConfigured }: Props) {
  const t = useTranslations('dashboard.pages.config.stripe')

  const hint = !settings.configured
    ? t('toggle.incomplete')
    : settings.usesEnvFallback
      ? t('toggle.envFallback')
      : undefined

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success(t('webhookUrl.copied'))
    } catch {
      toast.error(t('webhookUrl.copyFailed'))
    }
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <FlagToggle
        // Remonte l'interrupteur quand la configuration change : son état local ne suit
        // pas les props après `router.refresh()`.
        key={`${settings.available}-${settings.configured}`}
        title={t('toggle.label')}
        description={t('toggle.description')}
        hint={hint}
        enabled={settings.available}
        disabled={!settings.configured}
        onSave={setStripeEnabledAction}
      />
      {!secretStorageConfigured && (
        <p className="px-6 py-4 text-xs text-orange-600">{t('secretStorageHint')}</p>
      )}
      <StripeSecretForm
        kind={StripeSecretKind.SecretKey}
        status={settings.secretKey}
        secretStorageConfigured={secretStorageConfigured}
      />
      <StripeSecretForm
        kind={StripeSecretKind.WebhookSecret}
        status={settings.webhookSecret}
        secretStorageConfigured={secretStorageConfigured}
      />
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-graphite">{t('webhookUrl.label')}</h3>
            <p className="mt-1 text-sm text-graphite-600">{t('webhookUrl.description')}</p>
          </div>
          <code className="block min-w-0 break-all font-mono text-xs text-graphite">
            {webhookUrl}
          </code>
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={copyWebhookUrl}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t('webhookUrl.copy')}
        </Button>
      </div>
    </SettingsSection>
  )
}
