import { storageGateway } from '@/gateways/storage-gateway'
import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'
import { optimizeImageToWebp } from '@/lib/image-optimizer'
import { storeWebpImage, type UploadImageError } from './store-webp-image'

/**
 * Pas d'ICO : sharp ne le décode pas, et le favicon est désormais généré depuis le logo.
 * Un SVG est accepté puis rastérisé comme les autres formats.
 */
const ALLOWED_BRANDING_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

/** Un logo s'affiche en en-tête et sur l'affiche, jamais au-delà de quelques centaines de pixels. */
const BRANDING_IMAGE_WEBP = { maxDimension: 512, quality: 90 }

export type UploadBrandingImageResult = { result: 'OK'; url: string } | { result: UploadImageError }

/** Toute image est stockée en WebP, quel que soit le format reçu. */
export async function uploadBrandingImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway,
  optimize = optimizeImageToWebp
): Promise<UploadBrandingImageResult> {
  const stored = await storeWebpImage(
    input,
    {
      allowedTypes: ALLOWED_BRANDING_IMAGE_TYPES,
      maxBytes: MAX_BRANDING_IMAGE_BYTES,
      webp: BRANDING_IMAGE_WEBP,
      prefix: 'branding',
    },
    storage,
    optimize
  )
  if (stored.result !== 'OK') return stored

  return { result: 'OK', url: stored.url }
}
