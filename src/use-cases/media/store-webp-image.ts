import type { storageGateway } from '@/gateways/storage-gateway'
import type { optimizeImageToWebp } from '@/lib/image-optimizer'

export type UploadImageError =
  | 'notConfigured'
  | 'unsupportedType'
  | 'fileTooLarge'
  | 'emptyFile'
  | 'invalidImage'

export async function storeWebpImage(
  input: { schoolId: string; contentType: string; bytes: Uint8Array; id: string },
  options: {
    allowedTypes: readonly string[]
    maxBytes: number
    webp: Parameters<typeof optimizeImageToWebp>[1]
    prefix: string
  },
  storage: typeof storageGateway,
  optimize: typeof optimizeImageToWebp
): Promise<{ result: 'OK'; key: string; url: string } | { result: UploadImageError }> {
  if (!options.allowedTypes.includes(input.contentType)) return { result: 'unsupportedType' }

  if (input.bytes.byteLength === 0) return { result: 'emptyFile' }
  if (input.bytes.byteLength > options.maxBytes) return { result: 'fileTooLarge' }

  const optimized = await optimize(input.bytes, options.webp)
  if (optimized.result !== 'OK') return optimized

  const key = `${options.prefix}/${input.schoolId}/${input.id}.webp`

  const stored = await storage.put({
    key,
    body: optimized.bytes,
    contentType: 'image/webp',
  })
  if (stored !== 'OK') return { result: stored }

  return { result: 'OK', key, url: `/api/media/${key}` }
}
