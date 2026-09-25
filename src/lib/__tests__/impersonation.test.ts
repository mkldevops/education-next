// @vitest-environment node
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedUser } from '@/domain/user'
import type { ImpersonationStart } from '@/gateways/impersonation-log-gateway'
import { IMPERSONATION_LOCKED_AUTH_PATHS, impersonation } from '../impersonation'

/**
 * Instance Better Auth réelle sur l'adaptateur mémoire : les crochets `before` du plugin
 * sont exercés par le même pipeline que `/api/auth/*` et `auth.api.*`.
 */
const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'password-1234'

type Tables = Record<string, Record<string, unknown>[]>

function setup(options: { failStart?: boolean; failEnd?: boolean } = {}) {
  const tables: Tables = { user: [], session: [], account: [], verification: [] }
  const superAdmins = new Set<string>()
  const starts: ImpersonationStart[] = []
  const ends: string[] = []

  const findUser = async (id: string): Promise<ManagedUser | null> => {
    const row = tables.user.find((u) => u.id === id)
    return row ? { id, isSuperAdmin: superAdmins.has(id), isActive: true } : null
  }

  const log = {
    recordStart: vi.fn(async (entry: ImpersonationStart) => {
      if (options.failStart) throw new Error('database down')
      starts.push(entry)
    }),
    recordEnd: vi.fn(async (sessionId: string) => {
      if (options.failEnd) throw new Error('database down')
      ends.push(sessionId)
    }),
  }

  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: 'test-secret-test-secret-test-secret-0123',
    database: memoryAdapter(tables),
    emailAndPassword: { enabled: true },
    user: {
      changeEmail: { enabled: true, sendChangeEmailConfirmation: async () => {} },
      deleteUser: { enabled: true },
    },
    rateLimit: { enabled: false },
    plugins: [impersonation({ findUser, log })],
  })

  return { auth, tables, superAdmins, starts, ends, log }
}

/** Rejoue les `Set-Cookie` sur un jar : un cookie réémis remplace l'ancien, un vide l'efface. */
function cookieHeaders(setCookie: string[], previous?: Headers): Headers {
  const jar = new Map<string, string>()
  for (const pair of (previous?.get('cookie') ?? '').split('; ').filter(Boolean)) {
    const [name, ...value] = pair.split('=')
    jar.set(name, value.join('='))
  }
  for (const line of setCookie) {
    const [name, ...value] = line.split(';')[0].split('=')
    const cookieValue = value.join('=')
    if (cookieValue) jar.set(name, cookieValue)
    else jar.delete(name)
  }
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
  return new Headers({ cookie, origin: BASE_URL })
}

async function signUp(auth: ReturnType<typeof setup>['auth'], email: string) {
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: email },
    returnHeaders: true,
  })
  return { userId: response.user.id, headers: cookieHeaders(headers.getSetCookie()) }
}

async function impersonate(ctx: ReturnType<typeof setup>) {
  const admin = await signUp(ctx.auth, 'admin@school.test')
  const target = await signUp(ctx.auth, 'parent@school.test')
  ctx.superAdmins.add(admin.userId)

  const { headers } = await ctx.auth.api.impersonateUser({
    headers: admin.headers,
    body: { userId: target.userId },
    returnHeaders: true,
  })
  // Le cookie de retour `admin_session` accompagne la session empruntée.
  const borrowed = cookieHeaders(headers.getSetCookie(), admin.headers)
  return { admin, target, borrowed }
}

async function refusal(call: () => Promise<unknown>) {
  try {
    await call()
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code
  }
  return 'resolved'
}

let ctx: ReturnType<typeof setup>

beforeEach(() => {
  ctx = setup()
})

describe('impersonation lock on Better Auth routes', () => {
  it('locks every credential and account route', () => {
    expect([...IMPERSONATION_LOCKED_AUTH_PATHS].sort()).toEqual(
      [
        '/change-email',
        '/change-password',
        '/delete-user',
        '/delete-user/callback',
        '/get-access-token',
        '/link-social',
        '/refresh-token',
        '/revoke-other-sessions',
        '/revoke-session',
        '/revoke-sessions',
        '/set-password',
        '/unlink-account',
      ].sort()
    )
  })

  it('refuses a password change from a borrowed session', async () => {
    const { borrowed } = await impersonate(ctx)

    const code = await refusal(() =>
      ctx.auth.api.changePassword({
        headers: borrowed,
        body: { currentPassword: PASSWORD, newPassword: 'another-pass-1234' },
      })
    )

    expect(code).toBe('impersonating')
  })

  it('refuses an email change from a borrowed session', async () => {
    const { borrowed } = await impersonate(ctx)

    const code = await refusal(() =>
      ctx.auth.api.changeEmail({ headers: borrowed, body: { newEmail: 'attacker@evil.test' } })
    )

    expect(code).toBe('impersonating')
  })

  it('refuses the account deletion from a borrowed session and keeps the user', async () => {
    const { borrowed, target } = await impersonate(ctx)

    const code = await refusal(() =>
      ctx.auth.api.deleteUser({ headers: borrowed, body: { password: PASSWORD } })
    )

    expect(code).toBe('impersonating')
    expect(ctx.tables.user.some((u) => u.id === target.userId)).toBe(true)
  })

  it('refuses session revocation from a borrowed session', async () => {
    const { borrowed } = await impersonate(ctx)

    expect(await refusal(() => ctx.auth.api.revokeSessions({ headers: borrowed }))).toBe(
      'impersonating'
    )
    expect(await refusal(() => ctx.auth.api.revokeOtherSessions({ headers: borrowed }))).toBe(
      'impersonating'
    )
    expect(
      await refusal(() =>
        ctx.auth.api.revokeSession({ headers: borrowed, body: { token: 'any-token' } })
      )
    ).toBe('impersonating')
  })

  it('refuses linking or unlinking a social account from a borrowed session', async () => {
    const { borrowed } = await impersonate(ctx)

    expect(
      await refusal(() =>
        ctx.auth.api.linkSocialAccount({ headers: borrowed, body: { provider: 'google' } })
      )
    ).toBe('impersonating')
    expect(
      await refusal(() =>
        ctx.auth.api.unlinkAccount({ headers: borrowed, body: { accountId: 'google' } })
      )
    ).toBe('impersonating')
  })

  it('refuses the same route over HTTP, not only through auth.api', async () => {
    const { borrowed } = await impersonate(ctx)

    const response = await ctx.auth.handler(
      new Request(`${BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          cookie: borrowed.get('cookie') ?? '',
          origin: BASE_URL,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'another-pass-1234' }),
      })
    )

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('impersonating')
  })

  it('leaves the same routes open to an ordinary session', async () => {
    const user = await signUp(ctx.auth, 'owner@school.test')

    const result = await ctx.auth.api.changePassword({
      headers: user.headers,
      body: { currentPassword: PASSWORD, newPassword: 'another-pass-1234' },
    })

    expect(result.user.id).toBe(user.userId)
  })
})

describe('impersonation trace', () => {
  it('records who borrowed whom, the borrowed session and its deadline on start', async () => {
    const { admin, target } = await impersonate(ctx)

    const borrowedSession = ctx.tables.session.find((s) => s.impersonatedBy === admin.userId)
    expect(ctx.starts).toEqual([
      expect.objectContaining({
        actorId: admin.userId,
        actorEmail: 'admin@school.test',
        targetId: target.userId,
        targetEmail: 'parent@school.test',
        sessionId: borrowedSession?.id,
        expiresAt: borrowedSession?.expiresAt,
      }),
    ])
  })

  it('closes the trace on stop, before the borrowed session disappears', async () => {
    const { borrowed, admin } = await impersonate(ctx)
    const sessionId = ctx.starts[0].sessionId

    const result = await ctx.auth.api.stopImpersonating({ headers: borrowed })

    expect(result.userId).toBe(admin.userId)
    expect(ctx.ends).toEqual([sessionId])
    expect(ctx.tables.session.some((s) => s.id === sessionId)).toBe(false)
  })

  it('closes the trace when the borrowed session signs out', async () => {
    const { borrowed } = await impersonate(ctx)
    const sessionId = ctx.starts[0].sessionId

    await ctx.auth.api.signOut({ headers: borrowed })

    expect(ctx.ends).toEqual([sessionId])
  })

  it('still removes the borrowed session when the trace cannot be closed on sign-out', async () => {
    ctx = setup({ failEnd: true })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { borrowed } = await impersonate(ctx)
    const sessionId = ctx.starts[0].sessionId

    await ctx.auth.api.signOut({ headers: borrowed })

    expect(ctx.log.recordEnd).toHaveBeenCalledWith(sessionId)
    expect(ctx.tables.session.some((s) => s.id === sessionId)).toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('does not touch the trace when an ordinary session signs out', async () => {
    const user = await signUp(ctx.auth, 'owner@school.test')

    await ctx.auth.api.signOut({ headers: user.headers })

    expect(ctx.log.recordEnd).not.toHaveBeenCalled()
  })

  it('refuses to impersonate without a trace and removes the borrowed session', async () => {
    ctx = setup({ failStart: true })
    const admin = await signUp(ctx.auth, 'admin@school.test')
    const target = await signUp(ctx.auth, 'parent@school.test')
    ctx.superAdmins.add(admin.userId)

    await expect(
      ctx.auth.api.impersonateUser({ headers: admin.headers, body: { userId: target.userId } })
    ).rejects.toThrow()
    expect(ctx.tables.session.some((s) => s.impersonatedBy === admin.userId)).toBe(false)
  })
})
