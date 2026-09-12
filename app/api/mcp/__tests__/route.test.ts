import { beforeEach, describe, expect, it, vi } from 'vitest'

const isMcpEnabledMock = vi.fn()
const resolveMcpScopeMock = vi.fn()
const buildMcpServerMock = vi.fn()
const touchMock = vi.fn()
const fetchMock = vi.fn()
const createMcpHandlerMock = vi.fn(() => ({ fetch: fetchMock }))
const afterMock = vi.fn()
const purgeExpiredDraftsMock = vi.fn()

vi.mock('@modelcontextprotocol/server', () => ({ createMcpHandler: createMcpHandlerMock }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))
vi.mock('@/mcp/server', () => ({ buildMcpServer: buildMcpServerMock }))
vi.mock('@/gateways/mcp-api-key-gateway', () => ({ mcpApiKeyGateway: { touch: touchMock } }))
vi.mock('@/use-cases/mcp/resolve-mcp-scope', () => ({ resolveMcpScope: resolveMcpScopeMock }))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))
vi.mock('@/use-cases/mcp/purge-expired-drafts', () => ({
  purgeExpiredDrafts: purgeExpiredDraftsMock,
}))

const { DELETE, GET, POST } = await import('../route')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
}

const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost:8550/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })

const authorized = () => request({ authorization: 'Bearer edu_mcp_key' })

beforeEach(() => {
  vi.clearAllMocks()
  isMcpEnabledMock.mockResolvedValue(true)
  resolveMcpScopeMock.mockResolvedValue({ status: 'OK', scope })
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
})

describe('POST /api/mcp', () => {
  it('refuses everything while the platform flag is off, before authenticating', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    const response = await POST(authorized())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'mcpDisabled' })
    expect(resolveMcpScopeMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 401 without a usable credential', async () => {
    resolveMcpScopeMock.mockResolvedValue({ status: 'unauthenticated' })

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 403 for an authenticated key whose holder lost the right', async () => {
    resolveMcpScopeMock.mockResolvedValue({ status: 'forbidden' })

    const response = await POST(authorized())

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hands the resolved scope to the SDK without ever exposing the presented key', async () => {
    await POST(authorized())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    expect(options.authInfo.extra.scope).toEqual(scope)
    expect(JSON.stringify(options.authInfo)).not.toContain('edu_mcp_key')
  })

  /**
   * Le SDK passe la `Request` qu'il reçoit à la factory de serveur (`requestInfo`) et au
   * contexte d'exécution des outils : elle est aussi lisible qu'`authInfo`. Transmettre
   * l'originale ferait donc franchir la frontière à la clé présentée, exactement ce que
   * `toAuthInfo` refuse un cran plus bas.
   */
  it('forwards a request stripped of every credential header', async () => {
    await POST(
      request({
        authorization: 'Bearer edu_mcp_key',
        'x-api-key': 'edu_mcp_key',
        cookie: 'better-auth.session_token=session-secret',
        'proxy-authorization': 'Basic cHJveHk6c2VjcmV0',
      })
    )

    const [forwarded] = fetchMock.mock.calls[0]
    expect(forwarded.headers.get('authorization')).toBeNull()
    expect(forwarded.headers.get('x-api-key')).toBeNull()
    expect(forwarded.headers.get('cookie')).toBeNull()
    expect(forwarded.headers.get('proxy-authorization')).toBeNull()
  })

  it('keeps the headers, method, url and body the SDK needs to serve the call', async () => {
    const original = request({
      authorization: 'Bearer edu_mcp_key',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-session-id': 'session-1',
    })

    await POST(original)

    const [forwarded] = fetchMock.mock.calls[0]
    expect(forwarded.method).toBe('POST')
    expect(forwarded.url).toBe(original.url)
    expect(forwarded.headers.get('content-type')).toBe('application/json')
    expect(forwarded.headers.get('accept')).toBe('application/json, text/event-stream')
    expect(forwarded.headers.get('mcp-protocol-version')).toBe('2026-07-28')
    expect(forwarded.headers.get('mcp-session-id')).toBe('session-1')
    expect(await forwarded.json()).toEqual({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  })

  /**
   * Le SDK abandonne ses flux sur ce signal. Reconstruire la requête depuis son URL
   * plutôt que depuis la requête elle-même le perdrait sans rien casser d'autre.
   */
  it('keeps the abort signal the SDK uses to tear down a call', async () => {
    const controller = new AbortController()
    const original = new Request('http://localhost:8550/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer edu_mcp_key' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      signal: controller.signal,
    })

    await POST(original)

    const [forwarded] = fetchMock.mock.calls[0]
    expect(forwarded.signal.aborted).toBe(false)

    controller.abort()
    expect(forwarded.signal.aborted).toBe(true)
  })
  const runAfterCallbacks = () => {
    for (const [callback] of afterMock.mock.calls) callback()
  }

  it('records the key usage off the response path', async () => {
    await POST(authorized())

    expect(touchMock).not.toHaveBeenCalled()

    runAfterCallbacks()
    expect(touchMock).toHaveBeenCalledWith('key-1', expect.any(Date), expect.any(Date))
  })

  it('sweeps expired drafts off the response path', async () => {
    await POST(authorized())

    expect(purgeExpiredDraftsMock).not.toHaveBeenCalled()

    runAfterCallbacks()
    expect(purgeExpiredDraftsMock).toHaveBeenCalledWith(expect.any(Date))
  })

  /**
   * La rétention ne dépend pas de l'ouverture du service : une instance fermée continue de
   * balayer, sinon des données personnelles expirées survivraient au drapeau.
   */
  it('still sweeps while the platform flag is off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    const response = await POST(authorized())

    expect(response.status).toBe(503)
    runAfterCallbacks()
    expect(purgeExpiredDraftsMock).toHaveBeenCalledWith(expect.any(Date))
  })

  it('turns an unexpected failure into a 500 rather than a stack trace', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    resolveMcpScopeMock.mockRejectedValue(new Error('boom'))

    const response = await POST(authorized())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'serverError' })
    consoleError.mockRestore()
  })

  /**
   * Invariante de sécurité de cette route : aucune autorité ambiante. Un cookie lu ici
   * rendrait la route falsifiable depuis un navigateur, ce qu'aucune validation
   * d'`Origin` ne rattraperait proprement.
   */
  it('never reads a cookie', async () => {
    const withCookie = authorized()
    const cookieReads = vi.fn()
    Object.defineProperty(withCookie.headers, 'get', {
      value: (name: string) => {
        if (name.toLowerCase() === 'cookie') cookieReads()
        return name.toLowerCase() === 'authorization' ? 'Bearer edu_mcp_key' : null
      },
    })

    await POST(withCookie)

    expect(cookieReads).not.toHaveBeenCalled()
  })
})

describe('unsupported methods', () => {
  it('answers 405 without a resumable stream or a session', async () => {
    for (const response of [GET(), DELETE()]) {
      expect(response.status).toBe(405)
      expect(await response.json()).toEqual({ error: 'methodNotAllowed' })
    }
  })
})
