// @vitest-environment node
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// La configuration réelle de `src/lib/auth.ts`, base exceptée : ces tests
// vérifient les options de production, pas une copie qui pourrait diverger.
const sendPlatformEmailMock = vi.fn()
const hasCredentialAccountMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/platform-email', () => ({ sendPlatformEmail: sendPlatformEmailMock }))
vi.mock('@/gateways/user-gateway', () => ({
  userGateway: { findManaged: vi.fn(), hasCredentialAccount: hasCredentialAccountMock },
}))

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
  vi.clearAllMocks()
  for (const table of Object.values(memory)) table.length = 0
  // Le mock `db` ne voit pas la mémoire de Better Auth : chaque test dit s'il
  // simule un compte déjà doté d'un mot de passe.
  hasCredentialAccountMock.mockImplementation(async (userId: string) =>
    memory.account.some((a) => a.userId === userId && a.providerId === 'credential')
  )
})

/** Jeton du lien envoyé par `sendResetPassword`, tel que le destinataire le suivrait. */
function mailedResetToken(): string {
  const content = sendPlatformEmailMock.mock.calls.at(-1)?.[2] as { cta: { url: string } }
  const token = content.cta.url.match(/\/reset-password\/([^?]+)/)?.[1]
  if (!token) throw new Error('reset link absent from the mail')
  return token
}

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

describe('credentialUserGateway.createWithoutPassword', () => {
  const EMAIL = 'directrice@ecole-b.fr'

  it('creates a verified account that nobody can sign in to by password', async () => {
    const { id } = await credentialUserGateway.createWithoutPassword({
      name: 'Directrice',
      email: 'Directrice@Ecole-B.FR',
    })

    expect(memory.user).toEqual([
      expect.objectContaining({ id, email: EMAIL, emailVerified: true }),
    ])
    expect(memory.account).toHaveLength(0)
    expect(memory.session).toHaveLength(0)

    // Regression #422 : l'admin qui a saisi l'adresse ne connaît aucun mot de passe
    // valide, quel que soit celui qu'il essaie.
    for (const password of ['password123', '', 'directrice']) {
      const response = await post('/sign-in/email', { email: EMAIL, password })
      expect(response.status).not.toBe(200)
    }
    expect(memory.session).toHaveLength(0)
  })

  it('lets the mailbox owner define the first password through the reset link', async () => {
    const { id } = await credentialUserGateway.createWithoutPassword({
      name: 'Directrice',
      email: EMAIL,
    })

    await testAuth.api.requestPasswordReset({
      body: { email: EMAIL, redirectTo: '/reset-password' },
    })

    expect(sendPlatformEmailMock).toHaveBeenCalledWith(
      EMAIL,
      'Définissez votre mot de passe',
      expect.objectContaining({
        cta: expect.objectContaining({ label: 'Choisir un mot de passe' }),
      })
    )

    await testAuth.api.resetPassword({
      body: { token: mailedResetToken(), newPassword: 'chosen-by-owner-1' },
    })

    expect(memory.account).toEqual([
      expect.objectContaining({ userId: id, providerId: 'credential', accountId: id }),
    ])

    const response = await post('/sign-in/email', { email: EMAIL, password: 'chosen-by-owner-1' })
    expect(response.status).toBe(200)
    expect(memory.session).toHaveLength(1)
  })

  it('refuses an address that already has an account', async () => {
    await credentialUserGateway.create({ name: 'K', email: EMAIL, password: 'password123' })

    await expect(
      credentialUserGateway.createWithoutPassword({ name: 'Intrus', email: EMAIL })
    ).rejects.toThrow()
    expect(memory.user).toHaveLength(1)
  })
})

describe('sendResetPassword wording', () => {
  it('words the mail as a reset once the account holds a password', async () => {
    await credentialUserGateway.create({
      name: 'K',
      email: 'k@school.test',
      password: 'password123',
    })

    await testAuth.api.requestPasswordReset({ body: { email: 'k@school.test' } })

    expect(sendPlatformEmailMock).toHaveBeenCalledWith(
      'k@school.test',
      'Réinitialisation de votre mot de passe',
      expect.anything()
    )
  })
})
