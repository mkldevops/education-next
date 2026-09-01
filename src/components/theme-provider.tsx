'use client'

const THEME_VAR_MAP: Record<string, string> = {
  theme_primary: '--theme-primary',
  theme_primary_hover: '--theme-primary-hover',
  theme_primary_light: '--theme-primary-light',
  theme_background: '--theme-background',
}

// Deuxième garde, après `setConfig` : les lignes antérieures à la validation du format
// n'ont jamais traversé le cas d'usage et arrivent ici telles qu'en base.
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

interface ThemeConfig {
  name: string
  value: string
}

interface Props {
  configs: ThemeConfig[]
}

export function ThemeProvider({ configs }: Props) {
  const css = configs
    .filter((c) => THEME_VAR_MAP[c.name] && HEX_COLOR.test(c.value))
    .map((c) => `${THEME_VAR_MAP[c.name]}: ${c.value};`)
    .join(' ')

  if (!css) return null

  return <style>{`:root { ${css} }`}</style>
}
