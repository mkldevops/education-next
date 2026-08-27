// @vitest-environment node
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const memory: Record<string, Record<string, unknown>[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
}

const testAuth = betterAuth({
  secret: 'test-secret-value-for-session-gateway-tests',
  baseURL: 'http://localhost:3000',
  database: memoryAdapter(memory),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
})

vi.mock('@/lib/auth', () => ({
  get auth() {
    return testAuth
  },
}))

const { sessionGateway } = await import('../session-gateway')

let userId: string

beforeAll(async () => {
  const context = await testAuth.$context
  const user = await context.internalAdapter.createUser({
    email: 'passkey-user@school.test',
    name: 'Passkey User',
    emailVerified: false,
  })
  userId = user.id
})

describe('sessionGateway.createForUser', () => {
  it('produces a cookie Better Auth accepts on getSession', async () => {
    const cookies = await sessionGateway.createForUser(
      userId,
      new Headers({ 'user-agent': 'vitest', 'x-forwarded-for': '203.0.113.7' })
    )

    expect(cookies.length).toBeGreaterThan(0)

    const cookieHeader = cookies.map((cookie) => cookie.split(';')[0]).join('; ')
    const session = await testAuth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    })

    expect(session?.user.id).toBe(userId)
  })

  it('signs the session token with the Better Auth cookie name and secret', async () => {
    const cookies = await sessionGateway.createForUser(userId, new Headers())
    const context = await testAuth.$context
    const cookieName = context.authCookies.sessionToken.name

    const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`))
    if (!sessionCookie) throw new Error(`cookie ${cookieName} absent de la réponse`)

    const value = decodeURIComponent(sessionCookie.split(';')[0].split('=')[1])
    const signature = value.slice(value.lastIndexOf('.') + 1)

    expect(value.lastIndexOf('.')).toBeGreaterThan(0)
    expect(signature).toHaveLength(44)
    expect(sessionCookie).toContain('HttpOnly')
  })

  it('persists the session so it is retrievable from storage', async () => {
    const before = memory.session.length

    await sessionGateway.createForUser(userId, new Headers())

    expect(memory.session.length).toBe(before + 1)
  })

  it('returns no cookie when the user does not exist', async () => {
    const cookies = await sessionGateway.createForUser('missing-user-id', new Headers())

    expect(cookies).toEqual([])
  })

  it('regression: a hand-written unsigned token cookie is rejected by getSession', async () => {
    const context = await testAuth.$context
    const session = await context.internalAdapter.createSession(userId)

    const unsigned = await testAuth.api.getSession({
      headers: new Headers({
        cookie: `${context.authCookies.sessionToken.name}=${session.token}`,
      }),
    })

    expect(unsigned).toBeNull()
  })
})
