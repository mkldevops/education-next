import { type NextRequest, NextResponse } from 'next/server'
import { storageGateway } from '@/gateways/storage-gateway'
import { auth } from '@/lib/auth'

// Fixed editorial assets only: this endpoint must never become a bucket browser.
const ASSETS = new Map([
  ['video', 'videos/connecter-claude-eic-elevenlabs-2026-11-01.mp4'],
  ['poster', 'videos/connecter-claude-eic-2026-11-01.jpg'],
  ['captions', 'videos/connecter-claude-eic-2026-11-01.fr.vtt'],
])

export async function GET(request: NextRequest, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params
  const key = ASSETS.get(asset)
  if (!key) return NextResponse.json({ error: 'notFound' }, { status: 404 })

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const range = request.headers.get('range') ?? undefined
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return NextResponse.json({ error: 'invalidRange' }, { status: 416 })
  }

  const object = await storageGateway.get(key, range)
  if (object === 'notConfigured') {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }
  if (object === 'notFound') {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }
  if (object === 'invalidRange') {
    return NextResponse.json({ error: 'invalidRange' }, { status: 416 })
  }

  return new NextResponse(object.body, {
    status: object.contentRange ? 206 : 200,
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      Vary: 'Cookie',
      ...(object.contentLength !== undefined
        ? { 'Content-Length': String(object.contentLength) }
        : {}),
      ...(object.contentRange ? { 'Content-Range': object.contentRange } : {}),
    },
  })
}
