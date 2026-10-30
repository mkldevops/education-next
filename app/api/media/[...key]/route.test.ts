// @vitest-environment node

import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/gateways/storage-gateway', () => ({ storageGateway: { get: vi.fn() } }))

import { storageGateway } from '@/gateways/storage-gateway'
import { GET } from './route'

const request = (key: string) =>
  GET(new NextRequest(`http://localhost/api/media/${key}`), {
    params: Promise.resolve({ key: key.split('/') }),
  })

describe('branding icon media', () => {
  beforeEach(() => vi.resetAllMocks())

  it('serves existing generated icons directly', async () => {
    vi.mocked(storageGateway.get).mockResolvedValue({
      body: new Blob(['png']).stream(),
      contentType: 'image/png',
    })
    const response = await request('branding/school/logo-icon-192.png')
    expect(await response.text()).toBe('png')
    expect(storageGateway.get).toHaveBeenCalledTimes(1)
  })

  it('renders a missing icon from a legacy uploaded WebP', async () => {
    const webp = await sharp({
      create: { width: 30, height: 60, channels: 4, background: '#ff0000' },
    })
      .webp()
      .toBuffer()
    vi.mocked(storageGateway.get)
      .mockResolvedValueOnce('notFound')
      .mockResolvedValueOnce({
        body: new Blob([new Uint8Array(webp)]).stream(),
        contentType: 'image/webp',
      })
    const response = await request('branding/school/logo-icon-512-maskable.png')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({
      width: 512,
      height: 512,
    })
    expect(storageGateway.get).toHaveBeenLastCalledWith('branding/school/logo.webp')
  })

  it('returns 404 when the original logo is missing', async () => {
    vi.mocked(storageGateway.get).mockResolvedValue('notFound')
    expect((await request('branding/school/logo-icon-192.png')).status).toBe(404)
  })

  it('rejects traversal before reading storage', async () => {
    expect((await request('branding/school/..-icon-192.png')).status).toBe(404)
    expect(storageGateway.get).not.toHaveBeenCalled()
  })

  it('does not generate variants for event images', async () => {
    vi.mocked(storageGateway.get).mockResolvedValue('notFound')
    expect((await request('events/school/logo-icon-192.png')).status).toBe(404)
    expect(storageGateway.get).toHaveBeenCalledTimes(1)
  })
})
