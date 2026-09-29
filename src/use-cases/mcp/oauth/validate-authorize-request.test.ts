import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizationResponseUrl, validateAuthorizeRequest } from './validate-authorize-request'

const ORIGIN = 'https://ecole-a.example'
const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'

const client = {
  id: CLIENT_ID,
  clientName: 'ChatGPT',
  redirectUris: [REDIRECT_URI],
  createdAt: new Date('2026-09-29T08:00:00Z'),
}

const query = {
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
  state: 'xyz',
}

const findById = vi.fn()
const validate = (overrides: Record<string, string | undefined> = {}) =>
  validateAuthorizeRequest({ ...query, ...overrides }, ORIGIN, { findById })

beforeEach(() => {
  vi.clearAllMocks()
  findById.mockResolvedValue(client)
})

describe('validateAuthorizeRequest', () => {
  it('accepts a PKCE S256 request for a registered URI and pins the resource', async () => {
    expect(await validate()).toEqual({
      status: 'OK',
      request: expect.objectContaining({ client_id: CLIENT_ID, scope: [] }),
      client: { id: CLIENT_ID, clientName: 'ChatGPT' },
      resource: `${ORIGIN}/api/mcp`,
    })
  })

  it('never redirects to an unknown client or an unregistered URI', async () => {
    findById.mockResolvedValueOnce(null)
    expect(await validate()).toEqual({ status: 'rejected', reason: 'invalidClient' })

    expect(await validate({ redirect_uri: 'https://evil.example/cb' })).toEqual({
      status: 'rejected',
      reason: 'invalidRedirectUri',
    })
    expect(await validate({ client_id: undefined })).toEqual({
      status: 'rejected',
      reason: 'invalidRequest',
    })
  })

  it('skips the lookup for an oversized client id', async () => {
    expect(await validate({ client_id: 'x'.repeat(65) })).toEqual({
      status: 'rejected',
      reason: 'invalidClient',
    })
    expect(findById).not.toHaveBeenCalled()
  })

  it('sends the other errors back to the client with its state', async () => {
    expect(await validate({ code_challenge_method: 'plain' })).toEqual({
      status: 'redirectError',
      redirectUri: REDIRECT_URI,
      state: 'xyz',
      error: 'invalid_request',
    })
    expect(await validate({ scope: 'offline_access' })).toMatchObject({
      status: 'redirectError',
      error: 'invalid_scope',
    })
    expect(await validate({ resource: 'https://ecole-b.example/api/mcp' })).toMatchObject({
      status: 'redirectError',
      error: 'invalid_target',
    })
  })
})

describe('authorizationResponseUrl', () => {
  it('appends the parameters and the issuer to the registered URI', () => {
    const url = new URL(
      authorizationResponseUrl(`${REDIRECT_URI}?keep=1`, ORIGIN, {
        error: 'access_denied',
        state: 'xyz',
        code: undefined,
      })
    )

    expect(url.searchParams.get('keep')).toBe('1')
    expect(url.searchParams.get('error')).toBe('access_denied')
    expect(url.searchParams.get('state')).toBe('xyz')
    expect(url.searchParams.get('iss')).toBe(ORIGIN)
    expect(url.searchParams.has('code')).toBe(false)
  })
})
