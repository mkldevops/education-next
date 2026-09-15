import { describe, expect, it } from 'vitest'
import { resolveBrandingConfig } from '@/lib/branding'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'

describe('resolveBrandingConfig', () => {
  it('returns the configured logo', () => {
    const branding = resolveBrandingConfig([
      { name: BRANDING_CONFIG_KEYS.logoUrl, value: '/logo.png' },
    ])

    expect(branding).toEqual({ logoUrl: '/logo.png' })
  })

  it('ignores a legacy favicon_url row: the favicon always comes from the logo', () => {
    const branding = resolveBrandingConfig([
      { name: BRANDING_CONFIG_KEYS.logoUrl, value: '/logo.png' },
      { name: 'favicon_url', value: '/favicon.ico' },
    ])

    expect(branding).toEqual({ logoUrl: '/logo.png' })
  })

  it('ignores empty branding values', () => {
    const branding = resolveBrandingConfig([{ name: BRANDING_CONFIG_KEYS.logoUrl, value: '   ' }])

    expect(branding).toEqual({ logoUrl: undefined })
  })
})
