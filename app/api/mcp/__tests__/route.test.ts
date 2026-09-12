import { beforeEach, describe, expect, it, vi } from 'vitest'

const isMcpEnabledMock = vi.fn()
const resolveMcpScopeMock = vi.fn()
const buildMcpServerMock = vi.fn()
const touchMock = vi.fn()
const fetchMock = vi.fn()
const createMcpHandlerMock = vi.fn(() => ({ fetch: fetchMock }))
const afterMock = vi.fn()

vi.mock('@modelcontextprotocol/server', () => ({ createMcpHandler: createMcpHandlerMock }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}))
vi.mock('@/mcp/server', () => ({ buildMcpServer: buildMcpServerMock }))
vi.mock('@/gateways/mcp-api-key-gateway', () => ({ mcpApiKeyGateway: { touch: touchMock } }))
vi.mock('@/use-cases/mcp/resolve-mcp-scope', () => ({ resolveMcpScope: resolveMcpScopeMock }))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))

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

/** Une clé réelle : la route choisit l'étage de limitation sur la forme de la clé. */
const presentedKey = `edu_mcp_${'k'.repeat(43)}`

/** Les étages sont module-level et leur fenêtre glisse sur 60 s : une adresse par test. */
let addressSeq = 0

const authorized = () => request({ authorization: `Bearer ${presentedKey}` })

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
    expect(JSON.stringify(options.authInfo)).not.toContain(presentedKey)
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
        authorization: `Bearer ${presentedKey}`,
        'x-api-key': presentedKey,
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
      authorization: `Bearer ${presentedKey}`,
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
      headers: { 'content-type': 'application/json', authorization: `Bearer ${presentedKey}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      signal: controller.signal,
    })

    await POST(original)

    const [forwarded] = fetchMock.mock.calls[0]
    expect(forwarded.signal.aborted).toBe(false)

    controller.abort()
    expect(forwarded.signal.aborted).toBe(true)
  })

  it('records the key usage off the response path', async () => {
    await POST(authorized())

    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(touchMock).not.toHaveBeenCalled()

    afterMock.mock.calls[0][0]()
    expect(touchMock).toHaveBeenCalledWith('key-1', expect.any(Date), expect.any(Date))
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
        return name.toLowerCase() === 'authorization' ? `Bearer ${presentedKey}` : null
      },
    })

    await POST(withCookie)

    expect(cookieReads).not.toHaveBeenCalled()
  })

  /**
   * L'étage par adresse est un budget partagé : Claude atteint la route depuis une
   * poignée d'adresses de sortie d'Anthropic, et sans `x-forwarded-for` tout le trafic
   * retombe sur un seau unique. Le facturer au trafic authentifié rendrait `429` aux
   * clés de toutes les autres écoles dès qu'une seule est active.
   */
  it('keeps a key budget out of the shared address budget', async () => {
    addressSeq += 1
    const address = `203.0.113.${addressSeq}`
    const from = (headers: Record<string, string> = {}) =>
      request({ 'x-forwarded-for': address, ...headers })
    resolveMcpScopeMock.mockResolvedValue({ status: 'unauthenticated' })
    for (let i = 0; i < 120; i += 1) await POST(from())
    expect((await POST(from())).status).toBe(429)

    resolveMcpScopeMock.mockResolvedValue({ status: 'OK', scope })
    const response = await POST(from({ authorization: `Bearer ${presentedKey}` }))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('damps credential-less traffic before reading the platform flag', async () => {
    addressSeq += 1
    const address = `203.0.113.${addressSeq}`
    const anonymous = () => request({ 'x-forwarded-for': address })
    resolveMcpScopeMock.mockResolvedValue({ status: 'unauthenticated' })

    const statuses: number[] = []
    for (let i = 0; i < 120; i += 1) statuses.push((await POST(anonymous())).status)
    expect(statuses.filter((status) => status !== 401)).toEqual([])

    const refused = await POST(anonymous())

    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: 'tooManyRequests' })
    expect(isMcpEnabledMock).toHaveBeenCalledTimes(120)
  })

  /**
   * Une chaîne quelconque derrière `Bearer` n'est pas une clé. L'exempter de l'étage par
   * adresse laisserait un en-tête vide de sens échapper aux deux étages tout en faisant
   * payer, à chaque requête, la lecture en base du drapeau plateforme.
   */
  it('damps a malformed credential like credential-less traffic', async () => {
    addressSeq += 1
    const address = `203.0.113.${addressSeq}`
    const malformed = () => request({ 'x-forwarded-for': address, authorization: 'Bearer x' })
    resolveMcpScopeMock.mockResolvedValue({ status: 'unauthenticated' })

    for (let i = 0; i < 120; i += 1) await POST(malformed())
    const refused = await POST(malformed())

    expect(refused.status).toBe(429)
    expect(isMcpEnabledMock).toHaveBeenCalledTimes(120)
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
