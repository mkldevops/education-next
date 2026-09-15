import { storageGateway } from '@/gateways/storage-gateway'
import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'

const ALLOWED_BRANDING_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

export type UploadBrandingImageResult =
  | { result: 'OK'; url: string }
  | { result: 'notConfigured' | 'unsupportedType' | 'fileTooLarge' | 'emptyFile' }

export async function uploadBrandingImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  storage = storageGateway
): Promise<UploadBrandingImageResult> {
  const extension = ALLOWED_BRANDING_IMAGE_TYPES[input.contentType]
  if (!extension) return { result: 'unsupportedType' }

  if (input.bytes.byteLength === 0) return { result: 'emptyFile' }
  if (input.bytes.byteLength > MAX_BRANDING_IMAGE_BYTES) return { result: 'fileTooLarge' }

  const key = `branding/${input.schoolId}/${input.id}.${extension}`

  const stored = await storage.put({
    key,
    body: input.bytes,
    contentType: input.contentType,
  })
  if (stored !== 'OK') return { result: stored }

  return { result: 'OK', url: `/api/media/${key}` }
}
