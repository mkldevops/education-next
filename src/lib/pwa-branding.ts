import { cache } from 'react'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
import { semantic } from '@/lib/theme'
import { getThemeConfigs } from '@/lib/theme-configs'
import { isHexColor } from '@/lib/theme-palettes'

/** Window chrome needs an opaque color; alpha is composited like the page background. */
function opaqueColor(value: string | undefined, background: string) {
  if (!value || !isHexColor(value)) return background
  const hex = value.slice(1)
  if (hex.length === 3) return `#${[...hex].map((channel) => channel.repeat(2)).join('')}`
  if (hex.length === 6) return value
  const alpha = Number.parseInt(hex.slice(6), 16) / 255
  return `#${[0, 2, 4]
    .map((offset) => {
      const foreground = Number.parseInt(hex.slice(offset, offset + 2), 16)
      const behind = Number.parseInt(background.slice(offset + 1, offset + 3), 16)
      return Math.round(foreground * alpha + behind * (1 - alpha))
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`
}

/** Request-scoped: the manifest, metadata and viewport follow the same active school. */
export const getPwaBranding = cache(async () => {
  const schoolId = await resolveBrandingSchoolId()
  const [branding, configs] = schoolId
    ? await Promise.all([getBrandingConfig(schoolId), getThemeConfigs(schoolId)])
    : [undefined, []]
  const value = (name: string) => configs.find((config) => config.name === name)?.value
  const backgroundColor = opaqueColor(value('theme_background'), semantic.background)
  const primaryValue = value('theme_primary')
  return {
    schoolName: branding?.schoolName?.trim() || undefined,
    logoUrl: branding?.logoUrl,
    backgroundColor,
    themeColor:
      primaryValue && isHexColor(primaryValue)
        ? opaqueColor(primaryValue, backgroundColor)
        : semantic.primary,
  }
})
