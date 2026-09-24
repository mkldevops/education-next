// @vitest-environment node
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// La configuration réelle de `src/lib/auth.ts`, base exceptée : ces tests
// vérifient les options de production, pas une copie qui pourrait diverger.
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/platform-email', () => ({ sendPlatformEmail: vi.fn() }))
vi.mock('@/gateways/user-gateway', () => ({ userGateway: { findManaged: vi.fn() } }))

const memory: Record<string, Record<string, unknown>[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
}

const { auth: productionAuth } = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')

const BASE_URL = 'http://localhost:3000'

const testAuth = betterAuth({
  ...productionAuth.options,
  secret: 'test-secret-value-for-credential-user-tests',
  baseURL: BASE_URL,
  trustedOrigins: [BASE_URL],
  database: memoryAdapter(memory),
})

vi.mock('@/lib/auth', () => ({
  get auth() {
    return testAuth
  },
}))

const { credentialUserGateway } = await import('../credential-user-gateway')

function post(path: string, body: Record<string, unknown>) {
  return testAuth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const table of Object.values(memory)) table.length = 0
})

describe('public sign-up', () => {
  it('regression: POST /api/auth/sign-up/email is refused and creates nobody', async () => {
    const response = await post('/sign-up/email', {
      name: 'Intrus',
      email: 'future-invitee@school.test',
      password: 'password123',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED' })
    expect(memory.user).toHaveLength(0)
    expect(memory.session).toHaveLength(0)
  })

  it('refuses auth.api.signUpEmail on the server too', async () => {
    await expect(
      testAuth.api.signUpEmail({
        body: { name: 'Intrus', email: 'future-invitee@school.test', password: 'password123' },
      })
    ).rejects.toThrow()
    expect(memory.user).toHaveLength(0)
  })

  it('never lets Google create an account for an unknown address', () => {
    const google = productionAuth.options.socialProviders?.google
    expect(google).toMatchObject({ disableSignUp: true, disableImplicitSignUp: true })
  })

  it('refuses any user creation that runs inside a Better Auth endpoint', async () => {
    const createHook = productionAuth.options.databaseHooks?.user?.create?.before
    if (!createHook) throw new Error('hook absent')

    const user = { id: 'u', name: 'Intrus', email: 'x@school.test', emailVerified: true }
    const endpoint = { path: '/sign-in/social' } as unknown as Parameters<typeof createHook>[1]

    expect(
      await createHook({ ...user, createdAt: new Date(), updatedAt: new Date() }, endpoint)
    ).toBe(false)
    expect(
      await createHook({ ...user, createdAt: new Date(), updatedAt: new Date() }, null)
    ).toBeUndefined()
  })

  it('revokes pre-existing sessions on password reset', () => {
    expect(productionAuth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true)
  })
})

describe('credentialUserGateway.create', () => {
  it('creates a verified account that can sign in with its password', async () => {
    const { id } = await credentialUserGateway.create({
      name: 'Karim Benali',
      email: 'Karim.Benali@School.TEST',
      password: 'password123',
    })

    expect(memory.user).toEqual([
      expect.objectContaining({ id, email: 'karim.benali@school.test', emailVerified: true }),
    ])
    expect(memory.account).toEqual([
      expect.objectContaining({ userId: id, providerId: 'credential', accountId: id }),
    ])
    // Aucune session orpheline : seule la connexion ci-dessous en ouvre une.
    expect(memory.session).toHaveLength(0)

    const response = await post('/sign-in/email', {
      email: 'karim.benali@school.test',
      password: 'password123',
    })
    expect(response.status).toBe(200)
    expect(memory.session).toHaveLength(1)
  })

  it('refuses an address that already has an account', async () => {
    const input = { name: 'Karim', email: 'karim@school.test', password: 'password123' }
    await credentialUserGateway.create(input)

    await expect(credentialUserGateway.create(input)).rejects.toThrow()
    expect(memory.user).toHaveLength(1)
  })

  it('refuses a password outside Better Auth limits before writing anything', async () => {
    await expect(
      credentialUserGateway.create({ name: 'K', email: 'k@school.test', password: 'short' })
    ).rejects.toThrow()
    await expect(
      credentialUserGateway.create({
        name: 'K',
        email: 'k@school.test',
        password: 'x'.repeat(129),
      })
    ).rejects.toThrow()
    expect(memory.user).toHaveLength(0)
  })
})
