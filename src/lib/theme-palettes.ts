import type { SchoolConfigKey } from './school-config'

/**
 * Les quatre couleurs d'école éditées ensemble depuis `/dashboard/config`. L'ordre est
 * celui du nuancier : la couleur principale d'abord, le fond en dernier.
 */
export const THEME_COLOR_KEYS = [
  'theme_primary',
  'theme_primary_hover',
  'theme_primary_light',
  'theme_background',
] as const satisfies readonly SchoolConfigKey[]

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

export type ThemeColors = Record<ThemeColorKey, string>

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function isThemeColorKey(name: string): name is ThemeColorKey {
  return (THEME_COLOR_KEYS as readonly string[]).includes(name)
}

export type ThemePalette = {
  id: string
  colors: ThemeColors
}

const palette = (
  id: string,
  primary: string,
  primaryHover: string,
  primaryLight: string,
  background: string
): ThemePalette => ({
  id,
  colors: {
    theme_primary: primary,
    theme_primary_hover: primaryHover,
    theme_primary_light: primaryLight,
    theme_background: background,
  },
})

/**
 * Nuanciers prêts à l'emploi, tirés des palettes tendance de coolors.co puis répartis par
 * rôle. Chacun garde un texte blanc lisible sur la couleur principale (AA, 4,5:1) et une
 * couleur principale distincte de son fond clair (3:1) — le test du module y veille.
 */
export const THEME_PALETTES: readonly ThemePalette[] = [
  palette('teal', '#3c6e71', '#284b63', '#d9d9d9', '#f7f7f7'),
  palette('lagoon', '#457b9d', '#1d3557', '#cfe8ea', '#f1faee'),
  palette('slate', '#2b2d42', '#1b1d2b', '#edf2f4', '#f8f9fb'),
  palette('midnight', '#003566', '#001d3d', '#ffd60a', '#f5f7fa'),
  palette('ocean', '#007a9e', '#005f7a', '#fed9b7', '#fdfcdc'),
  palette('desert', '#264653', '#1b323c', '#e9c46a', '#fdf8ef'),
  palette('olive', '#606c38', '#283618', '#faedcd', '#fefae0'),
  palette('burgundy', '#9e2a2b', '#540b0e', '#fff3b0', '#fffdf5'),
  palette('forest', '#3a5a40', '#283c2b', '#dad7cd', '#f7f6f2'),
  palette('amethyst', '#5e548e', '#231942', '#e0b1cb', '#fbf7fc'),
]
