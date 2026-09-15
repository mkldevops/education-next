'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { ConfigValueType } from '@/generated/prisma/client'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import type { SchoolConfigKey } from '@/lib/school-config'
import { PlatformFlagToggle } from '../../../_components/platform-flag-toggle'
import { setConfigAction } from '../../../_lib/config-actions'
import { EditConfigDialog } from './edit-config-dialog'

export type SchoolSetting = {
  name: SchoolConfigKey
  value: string
  valueType: ConfigValueType
}

async function saveFlag(name: SchoolConfigKey, enabled: boolean) {
  const result = await setConfigAction({ name, value: String(enabled) })
  return typeof result === 'string' ? result : 'OK'
}

/**
 * Liste fermée des réglages d'école, présentée comme les réglages plateforme : une ligne par
 * réglage, un interrupteur pour un booléen, une modale pour les autres valeurs.
 */
export function SchoolSettingsPanel({ settings }: { settings: SchoolSetting[] }) {
  const t = useTranslations('dashboard.pages.config')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-graphite">{t('sections.school')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('sections.schoolDescription')}</p>
      </div>
      <Card className="divide-y divide-alabaster-700 rounded border border-alabaster-700 p-0">
        {settings.map((setting) => {
          const label = t(`settings.${setting.name}.label`)
          const description = t(`settings.${setting.name}.description`)

          if (setting.valueType === 'BOOLEAN') {
            return (
              <PlatformFlagToggle
                key={setting.name}
                title={label}
                description={description}
                enabled={setting.value === 'true'}
                onSave={(enabled) => saveFlag(setting.name, enabled)}
              />
            )
          }

          return (
            <div
              key={setting.name}
              className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-graphite">{label}</h3>
                  <p className="mt-1 text-sm text-graphite-600">{description}</p>
                </div>
                <SettingValue setting={setting} notConfigured={t('notConfigured')} />
              </div>
              <div className="shrink-0">
                <EditConfigDialog config={setting} label={label} />
              </div>
            </div>
          )
        })}
      </Card>
    </section>
  )
}

function SettingValue({
  setting,
  notConfigured,
}: {
  setting: SchoolSetting
  notConfigured: string
}) {
  if (!setting.value) {
    return <p className="text-sm text-graphite-600">{notConfigured}</p>
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm text-graphite">
      {setting.valueType === 'COLOR' && (
        <span
          aria-hidden
          className="size-5 shrink-0 rounded border border-alabaster-700"
          style={{ backgroundColor: setting.value }}
        />
      )}
      {setting.name === BRANDING_CONFIG_KEYS.logoUrl && (
        // biome-ignore lint/performance/noImgElement: config URLs are dynamic
        <img
          src={setting.value}
          alt=""
          className="size-8 shrink-0 rounded border border-alabaster-700 object-contain"
        />
      )}
      <span className="min-w-0 break-all font-mono text-xs">{setting.value}</span>
    </div>
  )
}
