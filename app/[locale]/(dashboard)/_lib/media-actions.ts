'use server'

import { randomUUID } from 'node:crypto'
import { uploadBrandingImage } from '@/use-cases/media/upload-branding-image'
import { requireSchoolAdmin } from './auth-helper'

export async function uploadBrandingImageAction(formData: FormData) {
  const { schoolId } = await requireSchoolAdmin()

  const file = formData.get('file')
  if (!(file instanceof File)) return { result: 'invalidInput' as const }

  const bytes = new Uint8Array(await file.arrayBuffer())

  return uploadBrandingImage({
    schoolId,
    contentType: file.type,
    bytes,
    id: randomUUID(),
  })
}
