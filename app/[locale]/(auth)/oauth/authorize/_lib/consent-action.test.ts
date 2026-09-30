import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const findUniqueMock = vi.fn()
const redirectMock = vi.fn()
const isMcpEnabledMock = vi.fn()
const grantOAuthConsentMock = vi.fn()
const validateAuthorizeRequestMock = vi.fn()

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`)
  }
}

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirectMock(to)
    throw new RedirectSignal(to)
  },
}))
vi.mock('next-intl/server', () => ({ getLocale: async () => 'fr' }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: findUniqueMock } } }))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))
vi.mock('@/use-cases/mcp/oauth/grant-consent', () => ({
  grantOAuthConsent: grantOAuthConsentMock,
}))
vi.mock('@/use-cases/mcp/oauth/validate-authorize-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/use-cases/mcp/oauth/validate-authorize-request')>()),
  validateAuthorizeRequest: validateAuthorizeRequestMock,
}))

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ecole-a.example')

const { consentAction } = await import('./consent-action')

const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const SCHOOL_ID = '7b1f3f8e-2c6d-4a1e-9f0b-5d4c3b2a1e0f'
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'

const query = {
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
  state: 'xyz',
  scope: undefined,
  resource: undefined,
}

function form(entries: Record<string, string | undefined>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) data.append(key, value)
  }
  return data
}

const approve = (extra: Record<string, string | undefined> = {}) =>
  form({ ...query, schoolId: SCHOOL_ID, decision: 'approve', ...extra })

const session = { user: { id: 'user-1', email: 'admin@school.test' }, session: {} }

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue(session)
  findUniqueMock.mockResolvedValue({ id: 'user-1', isSuperAdmin: false })
  isMcpEnabledMock.mockResolvedValue(true)
  grantOAuthConsentMock.mockResolvedValue({
    status: 'OK',
    redirectTo: `${REDIRECT_URI}?code=x&state=xyz&iss=https%3A%2F%2Fecole-a.example`,
  })
  validateAuthorizeRequestMock.mockResolvedValue({
    status: 'OK',
    request: { ...query, scope: [] },
    client: { id: CLIENT_ID, clientName: 'ChatGPT' },
    resource: 'https://ecole-a.example/api/mcp',
  })
})

describe('consentAction', () => {
  it('sends an anonymous user to the login page with the whole request to replay', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(consentAction(null, approve())).rejects.toBeInstanceOf(RedirectSignal)

    const [to] = redirectMock.mock.calls[0]
    expect(to).toMatch(/^\/fr\/login\?redirectTo=/)
    const replay = decodeURIComponent(to.split('redirectTo=')[1])
    expect(replay.startsWith('/oauth/authorize?')).toBe(true)
    expect(new URLSearchParams(replay.slice('/oauth/authorize?'.length)).get('state')).toBe('xyz')
    expect(grantOAuthConsentMock).not.toHaveBeenCalled()
  })

  it('grants on the chosen school with the authenticated user and redirects to the client', async () => {
    await expect(consentAction(null, approve())).rejects.toBeInstanceOf(RedirectSignal)

    expect(grantOAuthConsentMock).toHaveBeenCalledWith({
      user: { id: 'user-1', isSuperAdmin: false },
      schoolId: SCHOOL_ID,
      query,
      origin: 'https://ecole-a.example',
    })
    expect(redirectMock).toHaveBeenCalledWith(
      `${REDIRECT_URI}?code=x&state=xyz&iss=https%3A%2F%2Fecole-a.example`
    )
  })

  it('returns access_denied to the registered URI, never to one read from the form', async () => {
    await expect(
      consentAction(null, approve({ decision: 'deny', redirect_uri: 'https://evil.example/cb' }))
    ).rejects.toBeInstanceOf(RedirectSignal)

    const [to] = redirectMock.mock.calls[0]
    const url = new URL(to)
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT_URI)
    expect(url.searchParams.get('error')).toBe('access_denied')
    expect(url.searchParams.get('state')).toBe('xyz')
    expect(url.searchParams.get('iss')).toBe('https://ecole-a.example')
    expect(grantOAuthConsentMock).not.toHaveBeenCalled()
  })

  it('refuses a denial of a request it cannot validate rather than redirecting anywhere', async () => {
    validateAuthorizeRequestMock.mockResolvedValue({ status: 'rejected', reason: 'invalidClient' })

    expect(await consentAction(null, approve({ decision: 'deny' }))).toEqual({
      error: 'invalidRequest',
    })
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('refuses to grant under a borrowed identity', async () => {
    getSessionMock.mockResolvedValue({
      ...session,
      session: { impersonatedBy: 'super-admin-1' },
    })

    expect(await consentAction(null, approve())).toEqual({ error: 'impersonating' })
    expect(grantOAuthConsentMock).not.toHaveBeenCalled()
  })

  it('refuses to grant while the platform flag is off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    expect(await consentAction(null, approve())).toEqual({ error: 'mcpDisabled' })
    expect(grantOAuthConsentMock).not.toHaveBeenCalled()
  })

  it('refuses a deactivated account', async () => {
    findUniqueMock.mockResolvedValue(null)

    expect(await consentAction(null, approve())).toEqual({ error: 'forbidden' })
    expect(grantOAuthConsentMock).not.toHaveBeenCalled()
  })

  it('surfaces the use-case refusal without redirecting', async () => {
    grantOAuthConsentMock.mockResolvedValue({ status: 'forbidden' })

    expect(await consentAction(null, approve())).toEqual({ error: 'forbidden' })
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('passes a missing school as an empty id, left to the use case to refuse', async () => {
    grantOAuthConsentMock.mockResolvedValue({ status: 'invalidRequest' })

    expect(await consentAction(null, approve({ schoolId: undefined }))).toEqual({
      error: 'invalidRequest',
    })
    expect(grantOAuthConsentMock.mock.calls[0][0].schoolId).toBe('')
  })
})
