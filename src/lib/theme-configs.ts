import { db } from '@/lib/db'
import { THEME_COLOR_KEYS } from '@/lib/theme-palettes'

/** Couleurs du thème d'une école, telles que `ThemeProvider` les attend. */
export function getThemeConfigs(schoolId: string) {
  return db.config.findMany({
    where: { schoolId, name: { in: [...THEME_COLOR_KEYS] }, isActive: true },
    select: { name: true, value: true },
  })
}
