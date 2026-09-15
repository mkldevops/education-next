import { storageGateway } from '@/gateways/storage-gateway'

export const MAX_EVENT_IMAGE_BYTES = 4 * 1024 * 1024

// Pas de svg/ico ici, contrairement à `upload-branding-image.ts` : ces images sont du
// contenu actif affiché aux familles, pas un habillage choisi par l'école elle-même.
const ALLOWED_EVENT_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type UploadEventImageResult =
  | { result: 'OK'; storageKey: string; url: string }
  | { result: 'notConfigured' | 'unsupportedType' | 'fileTooLarge' | 'emptyFile' }

export async function uploadEventImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway
): Promise<UploadEventImageResult> {
  const extension = ALLOWED_EVENT_IMAGE_TYPES[input.contentType]
  if (!extension) return { result: 'unsupportedType' }

  if (input.bytes.byteLength === 0) return { result: 'emptyFile' }
  if (input.bytes.byteLength > MAX_EVENT_IMAGE_BYTES) return { result: 'fileTooLarge' }

  const key = `events/${input.schoolId}/${input.id}.${extension}`

  const stored = await storage.put({
    key,
    body: input.bytes,
    contentType: input.contentType,
  })
  if (stored !== 'OK') return { result: stored }

  return { result: 'OK', storageKey: key, url: `/api/media/${key}` }
}
