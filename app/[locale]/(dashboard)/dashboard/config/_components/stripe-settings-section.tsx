'use client'

import { Button } from '@peaklab/ui'
import { Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PAYMENTS_ENABLED_CONFIG_KEY } from '@/lib/payment-config'
import { StripeSecretKind } from '@/lib/stripe-config'
import { toast } from '@/lib/toast'
import type { StripeSettings } from '@/use-cases/payments/stripe-settings'
import { FlagToggle } from '../../../_components/flag-toggle'
import { setConfigAction } from '../../../_lib/config-actions'
import { setStripeEnabledAction } from '../../../_lib/stripe-settings-actions'
import { SettingsSection } from './settings-section'
import { StripeSecretForm } from './stripe-secret-form'

type Props = {
  paymentsEnabled: boolean
  /** Ce que couper les paiements va masquer : paiements enregistrés et transactions en attente. */
  paymentFootprint: { payments: number; pendingTransactions: number }
  settings: StripeSettings
  webhookUrl: string
  secretStorageConfigured: boolean
}

async function savePaymentsEnabled(enabled: boolean) {
  const result = await setConfigAction({
    name: PAYMENTS_ENABLED_CONFIG_KEY,
    value: String(enabled),
  })
  return typeof result === 'string' ? result : 'OK'
}

/**
 * Paiements de l'école active. La gestion des paiements commande la section : coupée, le
 * paiement en ligne n'a plus d'objet et se replie, comme côté serveur où `payments_enabled`
 * l'emporte sur `stripe_enabled`. Sa coupure demande confirmation dès qu'un paiement ou une
 * transaction en attente deviendrait invisible.
 *
 * L'interrupteur Stripe reste figé tant qu'aucun jeu
 * d'identifiants complet n'est lisible — ni celui de l'école, ni celui de l'instance —, et
 * n'affiche activé que ce que le bouton parent proposera réellement.
 */
export function StripeSettingsSection({
  paymentsEnabled,
  paymentFootprint,
  settings,
  webhookUrl,
  secretStorageConfigured,
}: Props) {
  const t = useTranslations('dashboard.pages.config.stripe')
  const tConfig = useTranslations('dashboard.pages.config')
  const { payments, pendingTransactions } = paymentFootprint
  const paymentsKey = `settings.${PAYMENTS_ENABLED_CONFIG_KEY}`
  const confirmPaymentsDisable =
    payments > 0 || pendingTransactions > 0
      ? {
          title: tConfig(`${paymentsKey}.confirmDisable.title`),
          description: tConfig(`${paymentsKey}.confirmDisable.description`, {
            payments,
            pendingTransactions,
          }),
          confirmLabel: tConfig(`${paymentsKey}.confirmDisable.confirm`),
          cancelLabel: tConfig(`${paymentsKey}.confirmDisable.cancel`),
        }
      : undefined

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
        title={tConfig(`${paymentsKey}.label`)}
        description={tConfig(`${paymentsKey}.description`)}
        enabled={paymentsEnabled}
        onSave={savePaymentsEnabled}
        confirmDisable={confirmPaymentsDisable}
      />
      <div
        aria-hidden={!paymentsEnabled}
        inert={!paymentsEnabled}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          paymentsEnabled ? 'max-h-320 opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
      >
        <div className="divide-y divide-alabaster-700">
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
        </div>
      </div>
    </SettingsSection>
  )
}
