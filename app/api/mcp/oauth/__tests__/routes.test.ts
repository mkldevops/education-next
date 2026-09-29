import { beforeEach, describe, expect, it, vi } from 'vitest'

const isMcpEnabledMock = vi.fn()
const registerOAuthClientMock = vi.fn()
const exchangeOAuthTokenMock = vi.fn()
const revokeOAuthTokenMock = vi.fn()

vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))
vi.mock('@/use-cases/mcp/oauth/register-client', () => ({
  registerOAuthClient: registerOAuthClientMock,
}))
vi.mock('@/use-cases/mcp/oauth/exchange-token', () => ({
  exchangeOAuthToken: exchangeOAuthTokenMock,
}))
vi.mock('@/use-cases/mcp/oauth/revoke-token', () => ({ revokeOAuthToken: revokeOAuthTokenMock }))

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ecole-a.example')

const register = await import('../register/route')
const token = await import('../token/route')
const revoke = await import('../revoke/route')
const authorizationServer = await import('../../../../.well-known/oauth-authorization-server/route')
const protectedResource = await import('../../../../.well-known/oauth-protected-resource/route')
const protectedResourceByPath = await import(
  '../../../../.well-known/oauth-protected-resource/api/mcp/route'
)

/** Les étages sont module-level : une adresse par test. */
let addressSeq = 0
function nextAddress() {
  addressSeq += 1
  return `198.51.100.${addressSeq}`
}

const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

function jsonRequest(path: string, body: unknown, address = nextAddress()) {
  return new Request(`https://ecole-a.example${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
    body: JSON.stringify(body),
  })
}

function formRequest(path: string, body: Record<string, string>, address = nextAddress()) {
  return new Request(`https://ecole-a.example${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': address,
    },
    body: new URLSearchParams(body).toString(),
  })
}

const registration = {
  client_id: CLIENT_ID,
  client_id_issued_at: 1790668800,
  client_name: 'ChatGPT',
  redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
}

const tokens = {
  access_token: `edu_oat_${'a'.repeat(43)}`,
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: `edu_ort_${'r'.repeat(43)}`,
  scope: 'school:admin',
}

beforeEach(() => {
  vi.clearAllMocks()
  isMcpEnabledMock.mockResolvedValue(true)
  registerOAuthClientMock.mockResolvedValue(registration)
  exchangeOAuthTokenMock.mockResolvedValue({ status: 'OK', tokens })
  revokeOAuthTokenMock.mockResolvedValue('OK')
})

describe('POST /api/mcp/oauth/register', () => {
  it('registers a public client and answers 201 without caching', async () => {
    const body = { client_name: 'ChatGPT', redirect_uris: registration.redirect_uris }

    const response = await register.POST(jsonRequest('/api/mcp/oauth/register', body))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(registration)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(registerOAuthClientMock).toHaveBeenCalledWith(body)
  })

  it('answers invalid_client_metadata for a refused registration', async () => {
    registerOAuthClientMock.mockResolvedValue('invalidClientMetadata')

    const response = await register.POST(jsonRequest('/api/mcp/oauth/register', {}))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_client_metadata' })
  })

  it('refuses a registration while the platform flag is off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    const response = await register.POST(jsonRequest('/api/mcp/oauth/register', {}))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'temporarily_unavailable' })
    expect(registerOAuthClientMock).not.toHaveBeenCalled()
  })

  it('caps registrations per address, since each one writes a row', async () => {
    const address = nextAddress()
    for (let i = 0; i < 10; i += 1) {
      await register.POST(jsonRequest('/api/mcp/oauth/register', {}, address))
    }

    const refused = await register.POST(jsonRequest('/api/mcp/oauth/register', {}, address))

    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: 'too_many_requests' })
    expect(registerOAuthClientMock).toHaveBeenCalledTimes(10)
  })

  it('answers a CORS preflight for browser-based MCP clients', () => {
    const response = register.OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('POST /api/mcp/oauth/token', () => {
  const grant = {
    grant_type: 'authorization_code',
    code: `edu_oac_${'c'.repeat(43)}`,
    code_verifier: 'v'.repeat(43),
    client_id: CLIENT_ID,
    redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect',
    resource: 'https://ecole-a.example/api/mcp',
  }

  it('reads the form body of RFC 6749 and returns the issued tokens uncached', async () => {
    const response = await token.POST(formRequest('/api/mcp/oauth/token', grant))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(tokens)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(exchangeOAuthTokenMock).toHaveBeenCalledWith(grant)
  })

  it('reads a JSON body as well, string fields only', async () => {
    await token.POST(jsonRequest('/api/mcp/oauth/token', { ...grant, nested: { x: 1 } }))

    expect(exchangeOAuthTokenMock).toHaveBeenCalledWith({ ...grant, nested: undefined })
  })

  it.each([
    ['invalid_grant', 400],
    ['invalid_request', 400],
    ['invalid_target', 400],
    ['unsupported_grant_type', 400],
    ['invalid_client', 401],
  ])('maps %s to %i', async (error, status) => {
    exchangeOAuthTokenMock.mockResolvedValue({ status: error })

    const response = await token.POST(formRequest('/api/mcp/oauth/token', grant))

    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
  })

  it('refuses an unreadable body before any exchange', async () => {
    const response = await token.POST(
      new Request('https://ecole-a.example/api/mcp/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'text/plain', 'x-forwarded-for': nextAddress() },
        body: 'grant_type=authorization_code',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_request' })
    expect(exchangeOAuthTokenMock).not.toHaveBeenCalled()
  })

  it('refuses an exchange while the platform flag is off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    const response = await token.POST(formRequest('/api/mcp/oauth/token', grant))

    expect(response.status).toBe(503)
    expect(exchangeOAuthTokenMock).not.toHaveBeenCalled()
  })

  it('turns an unexpected failure into server_error rather than a stack trace', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    exchangeOAuthTokenMock.mockRejectedValue(new Error('boom'))

    const response = await token.POST(formRequest('/api/mcp/oauth/token', grant))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'server_error' })
    consoleError.mockRestore()
  })
})

describe('POST /api/mcp/oauth/revoke', () => {
  it('revokes the presented token and answers an empty 200 either way', async () => {
    const response = await revoke.POST(
      formRequest('/api/mcp/oauth/revoke', { token: tokens.access_token })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({})
    expect(revokeOAuthTokenMock).toHaveBeenCalledWith(tokens.access_token)
  })

  it('stays reachable while the platform flag is off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    const response = await revoke.POST(
      formRequest('/api/mcp/oauth/revoke', { token: tokens.refresh_token })
    )

    expect(response.status).toBe(200)
    expect(revokeOAuthTokenMock).toHaveBeenCalledWith(tokens.refresh_token)
  })

  it('refuses a body it cannot read', async () => {
    const response = await revoke.POST(
      new Request('https://ecole-a.example/api/mcp/oauth/revoke', {
        method: 'POST',
        headers: { 'x-forwarded-for': nextAddress() },
        body: 'token=x',
      })
    )

    expect(response.status).toBe(400)
    expect(revokeOAuthTokenMock).not.toHaveBeenCalled()
  })
})

describe('metadata documents', () => {
  it('serves the authorization server metadata on the configured origin', async () => {
    const response = authorizationServer.GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      issuer: 'https://ecole-a.example',
      authorization_endpoint: 'https://ecole-a.example/oauth/authorize',
      token_endpoint: 'https://ecole-a.example/api/mcp/oauth/token',
      registration_endpoint: 'https://ecole-a.example/api/mcp/oauth/register',
      revocation_endpoint: 'https://ecole-a.example/api/mcp/oauth/revoke',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('serves the same protected resource metadata at both well-known paths', async () => {
    const expected = {
      resource: 'https://ecole-a.example/api/mcp',
      authorization_servers: ['https://ecole-a.example'],
      scopes_supported: ['school:admin'],
      bearer_methods_supported: ['header'],
    }

    expect(await protectedResource.GET().json()).toEqual(expected)
    expect(await protectedResourceByPath.GET().json()).toEqual(expected)
    expect(protectedResourceByPath.OPTIONS().status).toBe(204)
  })
})
