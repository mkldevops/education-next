import { type NextRequest, NextResponse } from 'next/server'
import { storageGateway } from '@/gateways/storage-gateway'

// Route publique : les clés sont des UUID non énumérables (`<uuid>.<ext>`), l'absence
// d'authentification n'expose donc aucune image par essai d'URL.
const ALLOWED_KEY_PATTERN = /^(branding|events)\/[^/]+\/[^/]+$/

export async function GET(_request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params
  const objectKey = key.join('/')

  if (!ALLOWED_KEY_PATTERN.test(objectKey) || objectKey.includes('..')) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }

  const object = await storageGateway.get(objectKey)
  if (object === 'notConfigured') {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }
  if (object === 'notFound') {
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
