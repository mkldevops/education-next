// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getBrandingAssets } from '../branding-assets'
import { renderBrandingIcon } from '../branding-image'

const LOGO = '/api/media/branding/school-1/logo.webp'

describe('branding app icons', () => {
  it('keeps the source identity in every icon URL', () => {
    expect(getBrandingAssets(LOGO)?.map((asset) => asset.src)).toEqual([
      '/api/media/branding/school-1/logo-icon-192.png',
      '/api/media/branding/school-1/logo-icon-512.png',
      '/api/media/branding/school-1/logo-icon-192-maskable.png',
      '/api/media/branding/school-1/logo-icon-512-maskable.png',
      '/api/media/branding/school-1/logo-icon-180-apple.png',
    ])
    expect(getBrandingAssets('https://example.test/logo.webp')).toBeUndefined()
    expect(getBrandingAssets()).toBeUndefined()
  })

  it('generates exact square PNG dimensions for all five variants', async () => {
    const logo = await sharp({
      create: { width: 400, height: 200, channels: 4, background: '#ff0000' },
    })
      .png()
      .toBuffer()
    for (const asset of getBrandingAssets(LOGO) ?? []) {
      const png = await renderBrandingIcon(logo, asset)
      const metadata = await sharp(png).metadata()
      expect(metadata).toMatchObject({ format: 'png', width: asset.size, height: asset.size })
      const { data, info } = await sharp(png)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const pixel = (x: number, y: number) => [
        ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
      ]
      expect(pixel(0, 0)).toEqual([255, 255, 255])
      expect(pixel(Math.floor(asset.size / 2), Math.floor(asset.size / 2))).toEqual([255, 0, 0])
      if (asset.purpose === 'maskable') {
        // Even a corner of the contained artwork stays inside the 40%-radius safe circle.
        const margin = Math.ceil(asset.size * 0.22)
        expect(pixel(margin - 1, Math.floor(asset.size / 2))).toEqual([255, 255, 255])
        expect(Math.hypot(asset.size / 2 - margin, asset.size / 2 - margin)).toBeLessThan(
          asset.size * 0.4
        )
      }
    }
  })
})
