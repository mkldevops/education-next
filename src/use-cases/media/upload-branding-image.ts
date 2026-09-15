import { storageGateway } from '@/gateways/storage-gateway'
import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'
import { optimizeImageToWebp } from '@/lib/image-optimizer'

/**
 * Pas d'ICO : sharp ne le décode pas, et le favicon est désormais généré depuis le logo.
 * Un SVG est accepté puis rastérisé comme les autres formats.
 */
const ALLOWED_BRANDING_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

/** Un logo s'affiche en en-tête et sur l'affiche, jamais au-delà de quelques centaines de pixels. */
const BRANDING_IMAGE_WEBP = { maxDimension: 512, quality: 90 }

export type UploadBrandingImageResult =
  | { result: 'OK'; url: string }
  | { result: 'notConfigured' | 'unsupportedType' | 'fileTooLarge' | 'emptyFile' | 'invalidImage' }

/** Toute image est stockée en WebP, quel que soit le format reçu. */
export async function uploadBrandingImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway,
  optimize = optimizeImageToWebp
): Promise<UploadBrandingImageResult> {
  if (!ALLOWED_BRANDING_IMAGE_TYPES.includes(input.contentType)) {
    return { result: 'unsupportedType' }
  }

  if (input.bytes.byteLength === 0) return { result: 'emptyFile' }
  if (input.bytes.byteLength > MAX_BRANDING_IMAGE_BYTES) return { result: 'fileTooLarge' }

  const optimized = await optimize(input.bytes, BRANDING_IMAGE_WEBP)
  if (optimized.result !== 'OK') return optimized

  const key = `branding/${input.schoolId}/${input.id}.webp`

  const stored = await storage.put({
    key,
    body: optimized.bytes,
    contentType: 'image/webp',
  })
  if (stored !== 'OK') return { result: stored }

  return { result: 'OK', url: `/api/media/${key}` }
}
