import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'
import { uploadBrandingImage } from './upload-branding-image'

const storage = {
  put: vi.fn(),
  get: vi.fn(),
}

const ID = '11111111-2222-3333-4444-555555555555'
const SCHOOL_ID = 'school-1'

describe('uploadBrandingImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.put = vi.fn().mockResolvedValue('OK')
    storage.get = vi.fn()
  })

  it('stores a PNG under the branding prefix and returns its served URL', async () => {
    const result = await uploadBrandingImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'OK', url: `/api/media/branding/${SCHOOL_ID}/${ID}.png` })
    expect(storage.put).toHaveBeenCalledWith({
      key: `branding/${SCHOOL_ID}/${ID}.png`,
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    })
  })

  it('maps each accepted type to its extension', async () => {
    const cases: Array<[string, string]> = [
      ['image/jpeg', 'jpg'],
      ['image/webp', 'webp'],
      ['image/svg+xml', 'svg'],
      ['image/x-icon', 'ico'],
      ['image/vnd.microsoft.icon', 'ico'],
    ]

    for (const [contentType, extension] of cases) {
      const result = await uploadBrandingImage(
        { schoolId: SCHOOL_ID, contentType, bytes: new Uint8Array([1]), id: ID },
        storage
      )
      expect(result).toEqual({
        result: 'OK',
        url: `/api/media/branding/${SCHOOL_ID}/${ID}.${extension}`,
      })
    }
  })

  it('rejects a type outside the allowed list', async () => {
    const result = await uploadBrandingImage(
      { schoolId: SCHOOL_ID, contentType: 'application/pdf', bytes: new Uint8Array([1]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'unsupportedType' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('rejects an empty file', async () => {
    const result = await uploadBrandingImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'emptyFile' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const result = await uploadBrandingImage(
      {
        schoolId: SCHOOL_ID,
        contentType: 'image/png',
        bytes: new Uint8Array(MAX_BRANDING_IMAGE_BYTES),
        id: ID,
      },
      storage
    )

    expect(result).toEqual({ result: 'OK', url: `/api/media/branding/${SCHOOL_ID}/${ID}.png` })
  })

  it('rejects a file one byte over the limit', async () => {
    const result = await uploadBrandingImage(
      {
        schoolId: SCHOOL_ID,
        contentType: 'image/png',
        bytes: new Uint8Array(MAX_BRANDING_IMAGE_BYTES + 1),
        id: ID,
      },
      storage
    )

    expect(result).toEqual({ result: 'fileTooLarge' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('propagates a storage that is not configured', async () => {
    storage.put = vi.fn().mockResolvedValue('notConfigured')

    const result = await uploadBrandingImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([1]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'notConfigured' })
  })
})
