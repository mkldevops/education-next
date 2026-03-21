'use client'

const THEME_VAR_MAP: Record<string, string> = {
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
    .filter((c) => THEME_VAR_MAP[c.name])
    .map((c) => `${THEME_VAR_MAP[c.name]}: ${c.value};`)
    .join(' ')

  if (!css) return null

  return <style>{`:root { ${css} }`}</style>
}
