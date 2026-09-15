import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_EVENT_IMAGE_BYTES, uploadEventImage } from './upload-event-image'

const storage = {
  put: vi.fn(),
  get: vi.fn(),
}

const ID = '11111111-2222-3333-4444-555555555555'
const SCHOOL_ID = 'school-1'

describe('uploadEventImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.put = vi.fn().mockResolvedValue('OK')
    storage.get = vi.fn()
  })

  it('stores a PNG under the events prefix and returns its key and served URL', async () => {
    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]), id: ID },
      storage
    )

    expect(result).toEqual({
      result: 'OK',
      storageKey: `events/${SCHOOL_ID}/${ID}.png`,
      url: `/api/media/events/${SCHOOL_ID}/${ID}.png`,
    })
    expect(storage.put).toHaveBeenCalledWith({
      key: `events/${SCHOOL_ID}/${ID}.png`,
      body: expect.any(Uint8Array),
      contentType: 'image/png',
    })
  })

  it('maps each accepted type to its extension', async () => {
    const cases: Array<[string, string]> = [
      ['image/png', 'png'],
      ['image/jpeg', 'jpg'],
      ['image/webp', 'webp'],
    ]

    for (const [contentType, extension] of cases) {
      const result = await uploadEventImage(
        { schoolId: SCHOOL_ID, contentType, bytes: new Uint8Array([1]), id: ID },
        storage
      )

      expect(result).toMatchObject({
        result: 'OK',
        storageKey: `events/${SCHOOL_ID}/${ID}.${extension}`,
      })
    }
  })

  it('rejects svg, since it can carry active content shown to families', async () => {
    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/svg+xml', bytes: new Uint8Array([1]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'unsupportedType' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('rejects a type outside the allowed list', async () => {
    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'application/pdf', bytes: new Uint8Array([1]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'unsupportedType' })
  })

  it('rejects an empty file', async () => {
    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'emptyFile' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const bytes = new Uint8Array(MAX_EVENT_IMAGE_BYTES)

    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes, id: ID },
      storage
    )

    expect(result).toMatchObject({ result: 'OK' })
  })

  it('rejects a file one byte over the limit', async () => {
    const bytes = new Uint8Array(MAX_EVENT_IMAGE_BYTES + 1)

    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes, id: ID },
      storage
    )

    expect(result).toEqual({ result: 'fileTooLarge' })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('propagates a storage that is not configured', async () => {
    storage.put.mockResolvedValue('notConfigured')

    const result = await uploadEventImage(
      { schoolId: SCHOOL_ID, contentType: 'image/png', bytes: new Uint8Array([1]), id: ID },
      storage
    )

    expect(result).toEqual({ result: 'notConfigured' })
  })
})
