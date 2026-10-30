import sharp from 'sharp'
import type { BrandingIconVariant } from '@/lib/branding-assets'

/** Fit without distortion; maskable artwork stays inside the central safe circle. */
export async function renderBrandingIcon(bytes: Uint8Array, variant: BrandingIconVariant) {
  const inset = variant.purpose === 'maskable' ? Math.ceil(variant.size * 0.22) : 0
  const innerSize = variant.size - inset * 2
  return new Uint8Array(
    await sharp(bytes, { density: 300 })
      .rotate()
      .resize(innerSize, innerSize, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .extend({ top: inset, bottom: inset, left: inset, right: inset, background: '#ffffff' })
      .png()
      .toBuffer()
  )
}
