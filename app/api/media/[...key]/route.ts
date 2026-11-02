import { type NextRequest, NextResponse } from 'next/server'
import { storageGateway } from '@/gateways/storage-gateway'
import { BRANDING_ICON_VARIANTS } from '@/lib/branding-assets'
import { renderBrandingIcon } from '@/lib/branding-image'

// Route publique : les clés sont des UUID non énumérables (`<uuid>.<ext>`), l'absence
// d'authentification n'expose donc aucune image par essai d'URL.
const ALLOWED_KEY_PATTERN = /^(branding|events)\/[^/]+\/[^/]+$/

export async function GET(_request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params
  const objectKey = key.join('/')

  if (!ALLOWED_KEY_PATTERN.test(objectKey) || objectKey.includes('..')) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }

  let object = await storageGateway.get(objectKey)
  // Logos uploaded before icon generation remain usable without reuploading.
  if (object === 'notFound' && objectKey.startsWith('branding/')) {
    const variant = BRANDING_ICON_VARIANTS.find((item) =>
      objectKey.endsWith(`-icon-${item.suffix}.png`)
    )
    if (variant) {
      const sourceKey = objectKey.replace(`-icon-${variant.suffix}.png`, '.webp')
      const source = await storageGateway.get(sourceKey)
      if (source === 'notConfigured') object = source
      else if (source !== 'notFound' && source !== 'invalidRange') {
        try {
          const bytes = new Uint8Array(await new Response(source.body).arrayBuffer())
          const png = await renderBrandingIcon(bytes, variant)
          object = {
            body: new Blob([png]).stream(),
            contentType: 'image/png',
            contentLength: png.length,
          }
        } catch {
          object = 'notFound'
        }
      }
    }
  }
  if (object === 'notConfigured') {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }
  if (object === 'notFound' || object === 'invalidRange') {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }

  return new NextResponse(object.body, {
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
    },
  })
}
