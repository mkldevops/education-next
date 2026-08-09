'use server'

import { randomUUID } from 'node:crypto'
import { uploadBrandingImage } from '@/use-cases/media/upload-branding-image'
import { requireAdmin } from './auth-helper'

export async function uploadBrandingImageAction(formData: FormData) {
  const user = await requireAdmin()
  if (!user) return { result: 'unauthorized' as const }

  const file = formData.get('file')
  if (!(file instanceof File)) return { result: 'invalidInput' as const }

  const bytes = new Uint8Array(await file.arrayBuffer())

  return uploadBrandingImage({
    contentType: file.type,
    bytes,
    id: randomUUID(),
  })
}
