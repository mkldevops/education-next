// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, get } = vi.hoisted(() => ({ getSession: vi.fn(), get: vi.fn() }))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/gateways/storage-gateway', () => ({ storageGateway: { get } }))

import { GET } from './route'

const request = (asset = 'video', range?: string) =>
  GET(
    new NextRequest(`http://localhost/api/tutorials/claude-connection/${asset}`, {
      headers: range ? { Range: range } : {},
    }),
    { params: Promise.resolve({ asset }) }
  )

describe('Claude connection tutorial', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSession.mockResolvedValue({ user: { id: 'admin' } })
    get.mockResolvedValue({
      body: new Blob(['movie']).stream(),
      contentType: 'video/mp4',
      contentLength: 5,
    })
  })

  it('requires authentication before reading the private bucket', async () => {
    getSession.mockResolvedValue(null)
    expect((await request()).status).toBe(401)
    expect(get).not.toHaveBeenCalled()
  })

  it.each(['other', 'constructor', 'toString', '../secret'])(
    'rejects unknown asset %s',
    async (asset) => {
      expect((await request(asset)).status).toBe(404)
      expect(get).not.toHaveBeenCalled()
    }
  )

  it('streams the approved video without exposing an expiring storage URL', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(await response.text()).toBe('movie')
    expect(get).toHaveBeenCalledWith(
      'videos/connecter-claude-eic-elevenlabs-2026-11-01.mp4',
      undefined
    )
  })

  it('forwards byte ranges so the video can seek', async () => {
    get.mockResolvedValue({
      body: new Blob(['vie']).stream(),
      contentType: 'video/mp4',
      contentLength: 3,
      contentRange: 'bytes 2-4/5',
    })
    const response = await request('video', 'bytes=2-4')
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 2-4/5')
    expect(response.headers.get('content-length')).toBe('3')
    expect(get).toHaveBeenLastCalledWith(expect.any(String), 'bytes=2-4')
    expect(await response.text()).toBe('vie')
  })

  it('rejects multipart ranges before storage and propagates out-of-bounds ranges', async () => {
    expect((await request('video', 'bytes=0-1,3-4')).status).toBe(416)
    expect(get).not.toHaveBeenCalled()
    get.mockResolvedValue('invalidRange')
    expect((await request('video', 'bytes=100-')).status).toBe(416)
  })

  it.each([
    ['poster', 'videos/connecter-claude-eic-2026-11-01.jpg'],
    ['captions', 'videos/connecter-claude-eic-2026-11-01.fr.vtt'],
  ])('serves the fixed %s asset', async (asset, key) => {
    expect((await request(asset)).status).toBe(200)
    expect(get).toHaveBeenLastCalledWith(key, undefined)
  })

  it.each([
    ['notConfigured', 503],
    ['notFound', 404],
  ])('returns a controlled response when storage is %s', async (result, status) => {
    get.mockResolvedValue(result)
    expect((await request()).status).toBe(status)
  })
})
