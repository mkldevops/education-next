import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/branding', () => ({
  resolveBrandingSchoolId: vi.fn(),
  getBrandingConfig: vi.fn(),
}))

import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
import { getThemeConfigs } from '@/lib/theme-configs'
import manifest from '../manifest'

vi.mock('@/lib/theme-configs', () => ({ getThemeConfigs: vi.fn() }))

describe('school manifest', () => {
  beforeEach(() => {
    vi.mocked(getThemeConfigs).mockResolvedValue([])
    vi.mocked(resolveBrandingSchoolId).mockResolvedValue('school-1')
    vi.mocked(getBrandingConfig).mockResolvedValue({
      logoUrl: '/api/media/branding/school-1/logo.webp',
      schoolName: 'School',
    })
  })

  it('uses real school PNG sizes and maskable variants instead of platform icons', async () => {
    const result = await manifest()
    expect(result.icons).toEqual([
      {
        src: '/api/media/branding/school-1/logo-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/media/branding/school-1/logo-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/media/branding/school-1/logo-icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/api/media/branding/school-1/logo-icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ])
    expect(result.shortcuts?.[0].icons?.[0].src).toBe(
      '/api/media/branding/school-1/logo-icon-192.png'
    )
  })

  it('retains the platform defaults without school branding', async () => {
    vi.mocked(resolveBrandingSchoolId).mockResolvedValue(undefined)
    expect((await manifest()).icons).toHaveLength(4)
    expect((await manifest()).icons?.[0].src).toBe('/icon-192x192.png')
  })

  it('uses the school name while keeping the installed app identity stable', async () => {
    expect(await manifest()).toMatchObject({
      name: 'School',
      short_name: 'School',
      id: '/dashboard',
    })
    vi.mocked(resolveBrandingSchoolId).mockResolvedValue(undefined)
    expect(await manifest()).toMatchObject({
      name: 'Education App',
      short_name: 'Education',
      id: '/dashboard',
    })
  })

  it('uses validated school colors for the installed app window', async () => {
    vi.mocked(getThemeConfigs).mockResolvedValue([
      { name: 'theme_primary', value: '#123456' },
      { name: 'theme_background', value: '#abc' },
    ])
    expect(await manifest()).toMatchObject({ theme_color: '#123456', background_color: '#aabbcc' })
  })

  it('ignores invalid legacy colors and makes transparent colors opaque', async () => {
    vi.mocked(getThemeConfigs).mockResolvedValue([
      { name: 'theme_primary', value: '#00000080' },
      { name: 'theme_background', value: 'invalid' },
    ])
    expect(await manifest()).toMatchObject({ theme_color: '#7f7f7f', background_color: '#ffffff' })
    vi.mocked(getThemeConfigs).mockResolvedValue([{ name: 'theme_primary', value: 'red; bad-css' }])
    expect((await manifest()).theme_color).toBe('#3c6e71')
  })

  it('keeps manually entered external URLs usable', async () => {
    vi.mocked(getBrandingConfig).mockResolvedValue({
      logoUrl: 'https://example.test/logo.svg',
      schoolName: undefined,
    })
    expect((await manifest()).icons?.[0]).toMatchObject({
      src: 'https://example.test/logo.svg',
      type: 'image/svg+xml',
    })
  })
})
