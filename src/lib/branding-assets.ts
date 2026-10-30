/** Deterministic names shared by uploads, metadata and legacy media reads. */
export const BRANDING_ICON_VARIANTS = [
  { suffix: '192', size: 192, purpose: 'any' },
  { suffix: '512', size: 512, purpose: 'any' },
  { suffix: '192-maskable', size: 192, purpose: 'maskable' },
  { suffix: '512-maskable', size: 512, purpose: 'maskable' },
  { suffix: '180-apple', size: 180, purpose: 'apple' },
] as const

export type BrandingIconVariant = (typeof BRANDING_ICON_VARIANTS)[number]

function brandingIconPath(logoPath: string, variant: BrandingIconVariant) {
  return logoPath.replace(/\.[^/.]+$/, `-icon-${variant.suffix}.png`)
}

export function getBrandingAssets(logoUrl?: string) {
  if (!logoUrl || !/^\/api\/media\/branding\/[^/.]+\/[^/.]+\.webp$/.test(logoUrl)) {
    return undefined
  }
  return BRANDING_ICON_VARIANTS.map((variant) => ({
    ...variant,
    src: brandingIconPath(logoUrl, variant),
  }))
}
