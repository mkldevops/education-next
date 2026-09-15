import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_BRANDING_IMAGE_BYTES } from '@/lib/branding-config'
import { uploadBrandingImage } from './upload-branding-image'

const storage = {
  put: vi.fn(),
  get: vi.fn(),
}

const WEBP = new Uint8Array([9, 9, 9])
const optimize = vi.fn()

const ID = '11111111-2222-3333-4444-555555555555'
const SCHOOL_ID = 'school-1'

const upload = (contentType: string, bytes: Uint8Array) =>
  uploadBrandingImage({ schoolId: SCHOOL_ID, contentType, bytes, id: ID }, storage, optimize)

describe('uploadBrandingImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.put = vi.fn().mockResolvedValue('OK')
    storage.get = vi.fn()
    optimize.mockResolvedValue({ result: 'OK', bytes: WEBP })
  })

  it('stores the WebP conversion under the branding prefix and returns its served URL', async () => {
    const bytes = new Uint8Array([1, 2, 3])

    const result = await upload('image/png', bytes)

    expect(result).toEqual({ result: 'OK', url: `/api/media/branding/${SCHOOL_ID}/${ID}.webp` })
    expect(optimize).toHaveBeenCalledWith(bytes, { maxDimension: 512, quality: 90 })
    expect(storage.put).toHaveBeenCalledWith({
      key: `branding/${SCHOOL_ID}/${ID}.webp`,
      body: WEBP,
      contentType: 'image/webp',
    })
  })

  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])(
    'converts %s to WebP',
    async (contentType) => {
      const result = await upload(contentType, new Uint8Array([1]))

      expect(result).toEqual({ result: 'OK', url: `/api/media/branding/${SCHOOL_ID}/${ID}.webp` })
    }
  )

  it.each(['image/x-icon', 'image/vnd.microsoft.icon', 'application/pdf'])(
    'rejects %s',
    async (contentType) => {
      const result = await upload(contentType, new Uint8Array([1]))

      expect(result).toEqual({ result: 'unsupportedType' })
      expect(storage.put).not.toHaveBeenCalled()
    }
  )

  it('rejects an empty file', async () => {
    const result = await upload('image/png', new Uint8Array([]))

    expect(result).toEqual({ result: 'emptyFile' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const result = await upload('image/png', new Uint8Array(MAX_BRANDING_IMAGE_BYTES))

    expect(result).toMatchObject({ result: 'OK' })
  })

  it('rejects a file one byte over the limit, before converting it', async () => {
    const result = await upload('image/png', new Uint8Array(MAX_BRANDING_IMAGE_BYTES + 1))

    expect(result).toEqual({ result: 'fileTooLarge' })
    expect(optimize).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('stores nothing when the image cannot be decoded', async () => {
    optimize.mockResolvedValue({ result: 'invalidImage' })

    const result = await upload('image/png', new Uint8Array([1]))

    expect(result).toEqual({ result: 'invalidImage' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('propagates a storage that is not configured', async () => {
    storage.put = vi.fn().mockResolvedValue('notConfigured')

    const result = await upload('image/png', new Uint8Array([1]))

    expect(result).toEqual({ result: 'notConfigured' })
  })
})
