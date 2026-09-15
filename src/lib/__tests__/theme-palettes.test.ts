import { describe, expect, it } from 'vitest'
import { isHexColor, THEME_COLOR_KEYS, THEME_PALETTES } from '../theme-palettes'

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('THEME_PALETTES', () => {
  it('offers ten palettes with distinct ids', () => {
    expect(THEME_PALETTES).toHaveLength(10)
    expect(new Set(THEME_PALETTES.map((p) => p.id)).size).toBe(10)
  })

  it.each(THEME_PALETTES)('$id fills every theme color with a six-digit hex', ({ colors }) => {
    for (const key of THEME_COLOR_KEYS) {
      expect(colors[key]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(THEME_PALETTES)('$id keeps buttons and light accents readable', ({ colors }) => {
    expect(contrast('#ffffff', colors.theme_primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', colors.theme_primary_hover)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(colors.theme_primary, colors.theme_primary_light)).toBeGreaterThanOrEqual(3)
    expect(contrast(colors.theme_primary, colors.theme_background)).toBeGreaterThanOrEqual(3)
    expect(contrast(colors.theme_primary_hover, colors.theme_primary_light)).toBeGreaterThanOrEqual(
      4.5
    )
  })
})

describe('isHexColor', () => {
  it('accepts the three hex lengths and rejects anything that could close a CSS rule', () => {
    expect(isHexColor('#abc')).toBe(true)
    expect(isHexColor('#3c6e71')).toBe(true)
    expect(isHexColor('#3c6e71ff')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#3c6e71; } body { display: none')).toBe(false)
  })
})
