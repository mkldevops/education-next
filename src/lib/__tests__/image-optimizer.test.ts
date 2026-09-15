import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { optimizeImageToWebp } from '../image-optimizer'

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: '#3c6e71' } })
    .png()
    .toBuffer()

const metadataOf = async (result: Awaited<ReturnType<typeof optimizeImageToWebp>>) => {
  if (result.result !== 'OK') throw new Error(result.result)
  return sharp(result.bytes).metadata()
}

describe('optimizeImageToWebp', () => {
  it('re-encodes a PNG as WebP, shrinking its longest side to the maximum', async () => {
    const result = await optimizeImageToWebp(await png(3000, 1500), {
      maxDimension: 2000,
      quality: 80,
    })

    expect(await metadataOf(result)).toMatchObject({ format: 'webp', width: 2000, height: 1000 })
  })

  it('never enlarges a smaller image', async () => {
    const result = await optimizeImageToWebp(await png(320, 200), {
      maxDimension: 512,
      quality: 90,
    })

    expect(await metadataOf(result)).toMatchObject({ format: 'webp', width: 320, height: 200 })
  })

  it('rasterizes an SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>'
    )

    const result = await optimizeImageToWebp(svg, { maxDimension: 512, quality: 90 })

    expect((await metadataOf(result)).format).toBe('webp')
  })

  it('applies the EXIF orientation before dropping the metadata', async () => {
    const rotated = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()

    const metadata = await metadataOf(
      await optimizeImageToWebp(rotated, { maxDimension: 512, quality: 80 })
    )

    expect(metadata).toMatchObject({ width: 20, height: 40 })
    expect(metadata.orientation).toBeUndefined()
    expect(metadata.exif).toBeUndefined()
  })

  it('answers invalidImage for bytes it cannot decode', async () => {
    const result = await optimizeImageToWebp(new Uint8Array([1, 2, 3]), {
      maxDimension: 512,
      quality: 80,
    })

    expect(result).toEqual({ result: 'invalidImage' })
  })
})
