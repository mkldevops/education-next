import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { sanitizeImage } from './sanitize-image'

const image = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })

const decode = (dataUrl: string) => {
  const base64 = dataUrl.replace(/^data:image\/webp;base64,/, '')
  return sharp(Buffer.from(base64, 'base64'))
}

describe('sanitizeImage', () => {
  it('re-encodes a JPEG as a WebP data URL, capped to the largest side', async () => {
    const bytes = await image(3000, 1500).jpeg().toBuffer()

    const result = await sanitizeImage(new Uint8Array(bytes))

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
    expect(result.width).toBe(2000)
    expect(result.height).toBe(1000)
  })

  it('applies the EXIF orientation, then drops every metadata field', async () => {
    const bytes = await image(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer()

    const result = await sanitizeImage(new Uint8Array(bytes))

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    const output = await decode(result.dataUrl).metadata()
    expect(output.width).toBe(200)
    expect(output.height).toBe(400)
    expect(output.orientation).toBeUndefined()
    expect(output.exif).toBeUndefined()
  })

  it('accepts PNG and WebP inputs without enlarging them', async () => {
    const png = await image(120, 80).png().toBuffer()
    const webp = await image(120, 80).webp().toBuffer()

    for (const bytes of [png, webp]) {
      const result = await sanitizeImage(new Uint8Array(bytes))
      expect(result.status).toBe('OK')
      if (result.status !== 'OK') return
      expect(result.width).toBe(120)
      expect(result.height).toBe(80)
    }
  })

  it('refuses a GIF even though sharp could decode it', async () => {
    const bytes = await image(40, 40).gif().toBuffer()

    expect(await sanitizeImage(new Uint8Array(bytes))).toEqual({ status: 'forbiddenFile' })
  })

  it('refuses an SVG instead of rasterizing it', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'

    // Selon la build de sharp, le SVG est reconnu (`forbiddenFile`) ou illisible ; il
    // n'atteint jamais le fournisseur.
    const result = await sanitizeImage(new TextEncoder().encode(svg))
    expect(['forbiddenFile', 'unreadableImage']).toContain(result.status)
  })

  it('reports an unreadable file', async () => {
    expect(await sanitizeImage(new TextEncoder().encode('not an image at all'))).toEqual({
      status: 'unreadableImage',
    })
  })

  it('refuses declared dimensions above the pixel budget before decoding', async () => {
    // Un PNG dont l'en-tête annonce 7000 × 7000 : les dimensions se lisent sans décoder.
    const bytes = await image(7000, 7000).png({ compressionLevel: 9 }).toBuffer()

    expect(await sanitizeImage(new Uint8Array(bytes))).toEqual({ status: 'imageTooLarge' })
  }, 20_000)
})
