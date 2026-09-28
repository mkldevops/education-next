'use client'

import { useTranslations } from 'next-intl'
import { Fragment } from 'react'
import type { ConfigValueType } from '@/generated/prisma/client'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import {
  CLASS_SCHEDULE_ENABLED_CONFIG_KEY,
  CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY,
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
} from '@/lib/class-schedule-config'
import { PAYMENTS_ENABLED_CONFIG_KEY } from '@/lib/payment-config'
import type { SchoolConfigKey } from '@/lib/school-config'
import { TEACHER_EXPENSES_CONFIG_KEY } from '@/lib/teacher-expense-config'
import { isThemeColorKey, type ThemeColors } from '@/lib/theme-palettes'
import { FlagToggle } from '../../../_components/flag-toggle'
import { setConfigAction } from '../../../_lib/config-actions'
import { EditConfigDialog } from './edit-config-dialog'
import { SettingsSection } from './settings-section'
import { ThemePaletteEditor } from './theme-palette-editor'

const CLASS_SCHEDULE_DEPENDENT_KEYS: readonly SchoolConfigKey[] = [
  CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY,
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
]

export type SchoolSetting = {
  name: SchoolConfigKey
  value: string
  valueType: ConfigValueType
}

type Props = {
  settings: SchoolSetting[]
  /** Notes de frais déjà saisies, que la coupure rendrait inatteignables. */
  teacherExpenseCount: number
}

async function saveFlag(name: SchoolConfigKey, enabled: boolean) {
  const result = await setConfigAction({ name, value: String(enabled) })
  return typeof result === 'string' ? result : 'OK'
}

/**
 * Liste fermée des réglages d'école, présentée comme les réglages plateforme : une ligne par
 * réglage, un interrupteur pour un booléen, une modale pour les autres valeurs, et un nuancier
 * commun pour les quatre couleurs du thème.
 *
 * `payments_enabled` n'y figure pas : il commande la section Paiements, rendue par
 * `StripeSettingsSection`.
 *
 * Les notes de frais demandent une confirmation avant coupure, parce qu'elle rend invisible un
 * état déjà saisi. Le comptage vient du serveur pour que la confirmation énumère au lieu de
 * laisser l'administrateur deviner.
 */
export function SchoolSettingsPanel({ settings, teacherExpenseCount }: Props) {
  const t = useTranslations('dashboard.pages.config')
  const classScheduleEnabled =
    settings.find((setting) => setting.name === CLASS_SCHEDULE_ENABLED_CONFIG_KEY)?.value === 'true'
  const classScheduleSettings = settings.filter((setting) =>
    CLASS_SCHEDULE_DEPENDENT_KEYS.includes(setting.name)
  )
  const themeColors: Partial<ThemeColors> = Object.fromEntries(
    settings.flatMap((setting) =>
      isThemeColorKey(setting.name) ? [[setting.name, setting.value]] : []
    )
  )
  const firstThemeKey = settings.find((setting) => isThemeColorKey(setting.name))?.name

  const confirmDisableFor = (name: SchoolConfigKey) => {
    const confirmation = (key: string, values: Record<string, number>) => ({
      title: t(`settings.${key}.confirmDisable.title`),
      description: t(`settings.${key}.confirmDisable.description`, values),
      confirmLabel: t(`settings.${key}.confirmDisable.confirm`),
      cancelLabel: t(`settings.${key}.confirmDisable.cancel`),
    })

    if (name === TEACHER_EXPENSES_CONFIG_KEY && teacherExpenseCount > 0) {
      return confirmation(name, { expenses: teacherExpenseCount })
    }
    return undefined
  }

  const renderSetting = (setting: SchoolSetting, nested = false) => {
    // Les couleurs du thème partagent un nuancier, rendu à la place de la première.
    if (isThemeColorKey(setting.name)) {
      return setting.name === firstThemeKey ? (
        <ThemePaletteEditor key="theme" colors={themeColors} />
      ) : null
    }

    const label = t(`settings.${setting.name}.label`)
    const description = t(`settings.${setting.name}.description`)

    if (setting.valueType === 'BOOLEAN') {
      return (
        <FlagToggle
          key={setting.name}
          title={label}
          description={description}
          nested={nested}
          enabled={setting.value === 'true'}
          onSave={(enabled) => saveFlag(setting.name, enabled)}
          confirmDisable={confirmDisableFor(setting.name)}
        />
      )
    }

    return (
      <div
        key={setting.name}
        className={
          nested
            ? 'ml-6 flex flex-col gap-4 border-l-2 border-alabaster-700 py-5 pl-4 pr-6 sm:flex-row sm:items-start sm:justify-between'
            : 'flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between'
        }
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
  }

  return (
    <SettingsSection title={t('sections.school')} description={t('sections.schoolDescription')}>
      {settings.map((setting) => {
        if (
          setting.name === PAYMENTS_ENABLED_CONFIG_KEY ||
          CLASS_SCHEDULE_DEPENDENT_KEYS.includes(setting.name)
        ) {
          return null
        }

        const row = renderSetting(setting)
        if (setting.name !== CLASS_SCHEDULE_ENABLED_CONFIG_KEY) return row

        return (
          <Fragment key={setting.name}>
            {row}
            <div
              aria-hidden={!classScheduleEnabled}
              inert={!classScheduleEnabled}
              className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
                classScheduleEnabled
                  ? 'max-h-96 opacity-100'
                  : 'pointer-events-none max-h-0 opacity-0'
              }`}
            >
              <div className="divide-y divide-alabaster-700">
                {classScheduleSettings.map((dependentSetting) =>
                  renderSetting(dependentSetting, true)
                )}
              </div>
            </div>
          </Fragment>
        )
      })}
    </SettingsSection>
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
