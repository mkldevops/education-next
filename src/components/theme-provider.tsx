'use client'

import { isHexColor, isThemeColorKey, type ThemeColorKey } from '@/lib/theme-palettes'

const THEME_VAR_MAP: Record<ThemeColorKey, string> = {
  theme_primary: '--theme-primary',
  theme_primary_hover: '--theme-primary-hover',
  theme_primary_light: '--theme-primary-light',
  theme_background: '--theme-background',
}

interface ThemeConfig {
  name: string
  value: string
}

interface Props {
  configs: ThemeConfig[]
}

export function ThemeProvider({ configs }: Props) {
  const css = configs
    // Deuxième garde, après `setConfig` : les lignes antérieures à la validation du format
    // n'ont jamais traversé le cas d'usage et arrivent ici telles qu'en base.
    .filter(
      (c): c is ThemeConfig & { name: ThemeColorKey } =>
        isThemeColorKey(c.name) && isHexColor(c.value)
    )
    .map((c) => `${THEME_VAR_MAP[c.name]}: ${c.value};`)
    .join(' ')

  if (!css) return null

  return <style>{`:root { ${css} }`}</style>
}
