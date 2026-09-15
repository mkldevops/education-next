import { MAX_EVENT_IMAGE_BYTES } from '@/domain/event'
import { storageGateway } from '@/gateways/storage-gateway'
import { optimizeImageToWebp } from '@/lib/image-optimizer'

// Pas de svg ici, contrairement à `upload-branding-image.ts` : ces images sont du contenu
// affiché aux familles, pas un habillage choisi par l'école elle-même.
const ALLOWED_EVENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Assez pour la couverture 1200x630 de la page publique sur un écran haute densité. */
const EVENT_IMAGE_WEBP = { maxDimension: 2000, quality: 80 }

export type UploadEventImageResult =
  | { result: 'OK'; storageKey: string; url: string }
  | { result: 'notConfigured' | 'unsupportedType' | 'fileTooLarge' | 'emptyFile' | 'invalidImage' }

/** Toute image est stockée en WebP, quel que soit le format reçu. */
export async function uploadEventImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway,
  optimize = optimizeImageToWebp
): Promise<UploadEventImageResult> {
  if (!ALLOWED_EVENT_IMAGE_TYPES.includes(input.contentType)) return { result: 'unsupportedType' }

  if (input.bytes.byteLength === 0) return { result: 'emptyFile' }
  if (input.bytes.byteLength > MAX_EVENT_IMAGE_BYTES) return { result: 'fileTooLarge' }

  const optimized = await optimize(input.bytes, EVENT_IMAGE_WEBP)
  if (optimized.result !== 'OK') return optimized

  const key = `events/${input.schoolId}/${input.id}.webp`

  const stored = await storage.put({
    key,
    body: optimized.bytes,
    contentType: 'image/webp',
  })
  if (stored !== 'OK') return { result: stored }

  return { result: 'OK', storageKey: key, url: `/api/media/${key}` }
}
