import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyPasskeyAuthentication } from '@/actions/passkey-actions'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'better-auth.session_token'
const SESSION_TTL_DAYS = 7

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
const ipRequests = new Map<string, number[]>()

setInterval(() => {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS
  for (const [ip, timestamps] of ipRequests) {
    if (timestamps.every((t) => t <= windowStart)) {
      ipRequests.delete(ip)
    }
  }
}, RATE_LIMIT_WINDOW_MS)

function getClientIp(request: Request): string {
  const headers = request.headers
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',')
    return parts[parts.length - 1].trim()
  }
  return 'unknown'
}

function allowRequest(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = (ipRequests.get(ip) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= RATE_LIMIT_MAX) return false
  ipRequests.set(ip, [...timestamps, now])
  return true
}

function generateToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: 'tooManyRequests' }, { status: 429 })
  }

  try {
    const body = (await request.json()) as AuthenticationResponseJSON & { challengeId?: string }

    if (!body.challengeId) {
      return NextResponse.json({ error: 'missingChallengeId' }, { status: 400 })
    }

    if (!/^[a-f0-9]{32}$/.test(body.challengeId)) {
      return NextResponse.json({ error: 'invalidChallengeId' }, { status: 400 })
    }

    const result = await verifyPasskeyAuthentication(body, body.challengeId)

    if (typeof result === 'string') {
      console.error('[passkey/authenticate] authentication failed:', result)
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
        ipAddress: ip,
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
  } catch {
    return NextResponse.json({ error: 'serverError' }, { status: 500 })
  }
}
