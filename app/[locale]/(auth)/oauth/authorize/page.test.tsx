import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const findUniqueMock = vi.fn()
const redirectMock = vi.fn()
const isMcpEnabledMock = vi.fn()
const validateAuthorizeRequestMock = vi.fn()
const listAuthorizedSchoolsMock = vi.fn()
const listActiveMock = vi.fn()

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`)
  }
}

vi.mock('next/server', () => ({ connection: async () => undefined }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirectMock(to)
    throw new RedirectSignal(to)
  },
}))
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values?.host ? `${key}:${values.host}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: findUniqueMock } } }))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: { listActive: listActiveMock } }))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { listAuthorizedSchools: listAuthorizedSchoolsMock },
}))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))
vi.mock('@/use-cases/mcp/oauth/validate-authorize-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/use-cases/mcp/oauth/validate-authorize-request')>()),
  validateAuthorizeRequest: validateAuthorizeRequestMock,
}))
vi.mock('./_components/consent-form', () => ({
  ConsentForm: ({ schools, clientName }: { schools: { name: string }[]; clientName: string }) => (
    <div data-testid="consent-form">
      {clientName}:{schools.map((school) => school.name).join(',')}
    </div>
  ),
}))

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ecole-a.example')

const { default: OAuthAuthorizePage } = await import('./page')

const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'

const query = {
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
  state: 'xyz',
}

const renderPage = async () =>
  render(
    await OAuthAuthorizePage({
      params: Promise.resolve({ locale: 'fr' }),
      searchParams: Promise.resolve(query),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { id: 'user-1', email: 'admin@school.test' } })
  findUniqueMock.mockResolvedValue({ isSuperAdmin: false })
  isMcpEnabledMock.mockResolvedValue(true)
  validateAuthorizeRequestMock.mockResolvedValue({
    status: 'OK',
    request: { ...query, scope: [] },
    client: { id: CLIENT_ID, clientName: 'ChatGPT' },
    resource: 'https://ecole-a.example/api/mcp',
  })
  listAuthorizedSchoolsMock.mockResolvedValue([
    { roles: ['ADMIN'], school: { id: 'school-1', name: 'École A' } },
    { roles: ['PARENT'], school: { id: 'school-2', name: 'École B' } },
  ])
})

describe('OAuthAuthorizePage', () => {
  it('shows an unregistered client as an error, with nowhere to go back to', async () => {
    validateAuthorizeRequestMock.mockResolvedValue({ status: 'rejected', reason: 'invalidClient' })

    await renderPage()

    expect(screen.getByText('errors.invalidClient')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(redirectMock).not.toHaveBeenCalled()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('hands a malformed request back to the client through a link, never a redirect', async () => {
    validateAuthorizeRequestMock.mockResolvedValue({
      status: 'redirectError',
      redirectUri: REDIRECT_URI,
      state: 'xyz',
      error: 'invalid_request',
    })

    await renderPage()

    expect(screen.getByText('errors.invalidRequest')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'errors.returnToClient:chatgpt.com' })
    const url = new URL(link.getAttribute('href') ?? '')
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT_URI)
    expect(url.searchParams.get('error')).toBe('invalid_request')
    expect(url.searchParams.get('state')).toBe('xyz')
    expect(url.searchParams.get('iss')).toBe('https://ecole-a.example')
    expect(redirectMock).not.toHaveBeenCalled()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('refuses while the platform flag is off, before reading the session', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    await renderPage()

    expect(screen.getByText('errors.mcpDisabled')).toBeInTheDocument()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('sends an anonymous user to the login page with the request to replay', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(renderPage()).rejects.toBeInstanceOf(RedirectSignal)

    const [to] = redirectMock.mock.calls[0]
    expect(to).toMatch(/^\/fr\/login\?redirectTo=/)
    const replay = decodeURIComponent(to.split('redirectTo=')[1])
    expect(new URLSearchParams(replay.slice('/oauth/authorize?'.length)).get('state')).toBe('xyz')
  })

  it('offers only the schools the user administers', async () => {
    await renderPage()

    expect(screen.getByTestId('consent-form')).toHaveTextContent('ChatGPT:École A')
    expect(listActiveMock).not.toHaveBeenCalled()
  })

  it('offers every active school to a super admin', async () => {
    findUniqueMock.mockResolvedValue({ isSuperAdmin: true })
    listActiveMock.mockResolvedValue([
      { id: 'school-1', name: 'École A' },
      { id: 'school-2', name: 'École B' },
    ])

    await renderPage()

    expect(screen.getByTestId('consent-form')).toHaveTextContent('ChatGPT:École A,École B')
    expect(listAuthorizedSchoolsMock).not.toHaveBeenCalled()
  })
})
