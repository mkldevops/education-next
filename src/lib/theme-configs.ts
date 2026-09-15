import { db } from '@/lib/db'

const THEME_CONFIG_NAMES = [
  'theme_primary',
  'theme_primary_hover',
  'theme_primary_light',
  'theme_background',
]

/** Couleurs du thème d'une école, telles que `ThemeProvider` les attend. */
export function getThemeConfigs(schoolId: string) {
  return db.config.findMany({
    where: { schoolId, name: { in: THEME_CONFIG_NAMES }, isActive: true },
    select: { name: true, value: true },
  })
}
