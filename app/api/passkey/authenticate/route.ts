import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithPasskey } from '@/use-cases/auth/authenticate-with-passkey'
import { getClientIp, isRateLimited } from './_lib/rate-limit'

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
    if (isRateLimited(getClientIp(request))) {
      return NextResponse.json({ error: 'tooManyRequests' }, { status: 429 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalidRequest' }, { status: 400 })
    }

    const parsed = AuthBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalidRequest' }, { status: 400 })
    }

    const { challengeId, ...response } = parsed.data
    const result = await authenticateWithPasskey({
      response,
      challengeId,
      requestHeaders: request.headers,
    })

    if (result.status !== 'OK') {
      return NextResponse.json({ error: 'authenticationFailed' }, { status: 400 })
    }

    const success = NextResponse.json({ ok: true })
    for (const cookie of result.sessionCookies) {
      success.headers.append('set-cookie', cookie)
    }

    return success
  } catch (error) {
    console.error('[passkey/authenticate] unexpected error:', error)
    return NextResponse.json({ error: 'serverError' }, { status: 500 })
  }
}
