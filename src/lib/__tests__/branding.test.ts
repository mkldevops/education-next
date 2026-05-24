import { describe, expect, it } from 'vitest'
import { resolveBrandingConfig } from '@/lib/branding'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'

describe('resolveBrandingConfig', () => {
  it('uses favicon_url when configured', () => {
    const branding = resolveBrandingConfig([
      { name: BRANDING_CONFIG_KEYS.logoUrl, value: '/logo.png' },
      { name: BRANDING_CONFIG_KEYS.faviconUrl, value: '/favicon.ico' },
    ])

    expect(branding).toEqual({
      logoUrl: '/logo.png',
      faviconUrl: '/favicon.ico',
    })
  })

  it('uses the logo as favicon fallback', () => {
    const branding = resolveBrandingConfig([
      { name: BRANDING_CONFIG_KEYS.logoUrl, value: '/logo.png' },
    ])

    expect(branding).toEqual({
      logoUrl: '/logo.png',
      faviconUrl: '/logo.png',
    })
  })

  it('ignores empty branding values', () => {
    const branding = resolveBrandingConfig([
      { name: BRANDING_CONFIG_KEYS.logoUrl, value: '   ' },
      { name: BRANDING_CONFIG_KEYS.faviconUrl, value: '' },
    ])

    expect(branding).toEqual({
      logoUrl: undefined,
      faviconUrl: undefined,
    })
  })
})
