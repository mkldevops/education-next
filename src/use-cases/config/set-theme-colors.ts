import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { isHexColor, THEME_COLOR_KEYS } from '@/lib/theme-palettes'
import { setThemeColorsSchema } from './schemas'

type Input = z.infer<typeof setThemeColorsSchema>

/**
 * Écrit les couleurs d'école modifiées en une fois. Une couleur absente n'est pas touchée :
 * un jeton dérivé jamais posé continue de suivre la couleur principale.
 */
export async function setThemeColors(input: Input, configGw = configGateway) {
  const parsed = setThemeColorsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, colors } = parsed.data
  const entries = THEME_COLOR_KEYS.flatMap((name) => {
    const value = colors[name]
    return value === undefined ? [] : [{ name, value, valueType: 'COLOR' as const }]
  })
  if (entries.length === 0) return 'validationError' as const
  if (!entries.every((entry) => isHexColor(entry.value))) return 'invalidConfigValue' as const

  await configGw.setMany(schoolId, entries)
  return 'OK' as const
}
