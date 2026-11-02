// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/storage', () => ({
  getStorageClient: () => ({ send }),
  getStorageConfig: () => ({ bucket: 'education-next' }),
}))

import { storageGateway } from '../storage-gateway'

describe('storage ranged reads', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requests only the selected bytes and preserves their HTTP metadata', async () => {
    send.mockResolvedValue({
      Body: { transformToWebStream: () => new Blob(['vie']).stream() },
      ContentType: 'video/mp4',
      ContentLength: 3,
      ContentRange: 'bytes 2-4/5',
    })

    const result = await storageGateway.get('videos/tutorial.mp4', 'bytes=2-4')
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'education-next',
      Key: 'videos/tutorial.mp4',
      Range: 'bytes=2-4',
    })
    expect(result).toMatchObject({ contentLength: 3, contentRange: 'bytes 2-4/5' })
  })

  it('distinguishes an unsatisfiable range from a missing object', async () => {
    send.mockRejectedValueOnce(
      Object.assign(new Error('Range out of bounds'), { name: 'InvalidRange' })
    )
    expect(await storageGateway.get('videos/tutorial.mp4', 'bytes=100-')).toBe('invalidRange')
    send.mockRejectedValueOnce(Object.assign(new Error('Missing'), { name: 'NoSuchKey' }))
    expect(await storageGateway.get('videos/tutorial.mp4')).toBe('notFound')
  })
})
