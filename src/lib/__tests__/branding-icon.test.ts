import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { loadLogoDataUrl } from '../branding-icon'

const imageResponse = (contentType: string, status = 200) =>
  new Response(new Uint8Array([1, 2, 3]), { status, headers: { 'content-type': contentType } })

describe('loadLogoDataUrl', () => {
  it('resolves an uploaded logo against the application URL and inlines it', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test')
    const fetcher = vi.fn().mockResolvedValue(imageResponse('image/png'))

    const dataUrl = await loadLogoDataUrl('/api/media/branding/s1/logo.png', fetcher)

    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      'https://app.example.test/api/media/branding/s1/logo.png'
    )
    expect(dataUrl).toBe('data:image/png;base64,AQID')
    vi.unstubAllEnvs()
  })

  it('keeps an absolute logo URL as typed', async () => {
    const fetcher = vi.fn().mockResolvedValue(imageResponse('image/svg+xml; charset=utf-8'))

    const dataUrl = await loadLogoDataUrl('https://cdn.example.test/logo.svg', fetcher)

    expect(fetcher.mock.calls[0]?.[0].toString()).toBe('https://cdn.example.test/logo.svg')
    expect(dataUrl).toBe('data:image/svg+xml;base64,AQID')
  })

  it('converts an uploaded WebP logo to PNG, the renderer crashing on WebP', async () => {
    const webp = await sharp({
      create: { width: 8, height: 8, channels: 4, background: '#3c6e71' },
    })
      .webp()
      .toBuffer()
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array(webp), { headers: { 'content-type': 'image/webp' } })
      )

    const dataUrl = await loadLogoDataUrl('/api/media/branding/s1/logo.webp', fetcher)

    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    const png = Buffer.from(dataUrl?.split(',')[1] ?? '', 'base64')
    expect((await sharp(png).metadata()).format).toBe('png')
  })

  it.each([
    ['a WebP that cannot be decoded', imageResponse('image/webp')],

    ['a missing image', imageResponse('image/png', 404)],
    ['an icon format the renderer cannot draw', imageResponse('image/x-icon')],
    ['a non-image response', imageResponse('text/html')],
  ])('returns null for %s', async (_case, response) => {
    expect(await loadLogoDataUrl('/logo', vi.fn().mockResolvedValue(response))).toBeNull()
  })

  it('returns null when the image cannot be fetched', async () => {
    expect(await loadLogoDataUrl('/logo', vi.fn().mockRejectedValue(new Error('down')))).toBeNull()
  })
})
