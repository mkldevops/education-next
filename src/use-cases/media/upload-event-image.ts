import { MAX_EVENT_IMAGE_BYTES } from '@/domain/event'
import { storageGateway } from '@/gateways/storage-gateway'
import { optimizeImageToWebp } from '@/lib/image-optimizer'
import { storeWebpImage, type UploadImageError } from './store-webp-image'

// Pas de svg ici, contrairement à `upload-branding-image.ts` : ces images sont du contenu
// affiché aux familles, pas un habillage choisi par l'école elle-même.
const ALLOWED_EVENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Assez pour la couverture 1200x630 de la page publique sur un écran haute densité. */
const EVENT_IMAGE_WEBP = { maxDimension: 2000, quality: 80 }

export type UploadEventImageResult =
  | { result: 'OK'; storageKey: string; url: string }
  | { result: UploadImageError }

/** Toute image est stockée en WebP, quel que soit le format reçu. */
export async function uploadEventImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway,
  optimize = optimizeImageToWebp
): Promise<UploadEventImageResult> {
  const stored = await storeWebpImage(
    input,
    {
      allowedTypes: ALLOWED_EVENT_IMAGE_TYPES,
      maxBytes: MAX_EVENT_IMAGE_BYTES,
      webp: EVENT_IMAGE_WEBP,
      prefix: 'events',
    },
    storage,
    optimize
  )
  if (stored.result !== 'OK') return stored

  return { result: 'OK', storageKey: stored.key, url: stored.url }
}
