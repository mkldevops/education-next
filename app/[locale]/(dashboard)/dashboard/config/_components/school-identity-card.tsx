'use client'

import { Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { SchoolConfigKey } from '@/lib/school-config'
import { isThemeColorKey, type ThemeColors } from '@/lib/theme-palettes'
import { EditConfigDialog } from './edit-config-dialog'
import { OptionRow } from './option-row'
import type { SchoolSetting } from './school-setting'
import { ThemePaletteEditor } from './theme-palette-editor'

/**
 * Ce qui identifie l'école à l'écran : logo, couleurs du thème et capacité des classes. Ce
 * sont des valeurs, pas des modules : elles ne s'allument ni ne s'éteignent.
 */
export function SchoolIdentityCard({ settings }: { settings: SchoolSetting[] }) {
  const t = useTranslations('dashboard.pages.config')
  const themeColors: Partial<ThemeColors> = Object.fromEntries(
    settings.flatMap((setting) =>
      isThemeColorKey(setting.name) ? [[setting.name, setting.value]] : []
    )
  )
  const logo = settings.find((setting) => setting.name === SchoolConfigKey.LogoUrl)
  const maxStudents = settings.find(
    (setting) => setting.name === SchoolConfigKey.MaxStudentsPerClass
  )

  return (
    <Card className="divide-y divide-alabaster-700 rounded border border-alabaster-700 p-0">
      {logo && (
        <OptionRow
          label={t(`settings.${logo.name}.label`)}
          description={t(`settings.${logo.name}.description`)}
        >
          <div className="flex items-center gap-3">
            {logo.value ? (
              // biome-ignore lint/performance/noImgElement: config URLs are dynamic
              <img
                src={logo.value}
                alt=""
                className="size-10 rounded border border-alabaster-700 object-contain"
              />
            ) : (
              <span className="text-sm text-graphite-600">{t('notConfigured')}</span>
            )}
            <EditConfigDialog config={logo} label={t(`settings.${logo.name}.label`)} />
          </div>
        </OptionRow>
      )}
      <ThemePaletteEditor colors={themeColors} />
      {maxStudents && (
        <OptionRow
          label={t(`settings.${maxStudents.name}.label`)}
          description={t(`settings.${maxStudents.name}.description`)}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-graphite">
              {maxStudents.value || t('notConfigured')}
            </span>
            <EditConfigDialog
              config={maxStudents}
              label={t(`settings.${maxStudents.name}.label`)}
            />
          </div>
        </OptionRow>
      )}
    </Card>
  )
}
