import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyPasskeyAuthentication } from '@/actions/passkey-actions'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'better-auth.session_token'
const SESSION_TTL_DAYS = 7
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

const ipTimestamps = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  ipTimestamps.set(ip, recent)
  return false
}

function generateToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

const AuthBodySchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['cross-platform', 'platform']).optional(),
  challengeId: z.string().regex(/^[a-f0-9]{32}$/),
})

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'tooManyRequests' }, { status: 429 })
    }

    const parsed = AuthBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalidRequest' }, { status: 400 })
    }

    const body = parsed.data
    const result = await verifyPasskeyAuthentication(body, body.challengeId)

    if (typeof result === 'string') {
      return NextResponse.json({ error: 'authenticationFailed' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: result.userId } })
    if (!user?.isActive) {
      return NextResponse.json({ error: 'userNotFound' }, { status: 400 })
    }

    const token = generateToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        ipAddress: ip !== 'unknown' ? ip : null,
        userAgent: request.headers.get('user-agent') ?? null,
      },
    })

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[passkey/authenticate] unexpected error:', error)
    return NextResponse.json({ error: 'serverError' }, { status: 500 })
  }
}
