import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashMcpKey, sha256Base64Url } from '@/lib/mcp-key-crypto'
import { exchangeOAuthToken } from './exchange-token'

const CLIENT_ID = '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const OTHER_CLIENT_ID = '9d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'
const RESOURCE = 'https://ecole-a.example/api/mcp'

const code = `edu_oac_${'c'.repeat(43)}`
const refreshToken = `edu_ort_${'r'.repeat(43)}`
const verifier = 'v'.repeat(43)

const grant = {
  id: 'grant-1',
  schoolId: 'school-1',
  userId: 'user-1',
  clientId: CLIENT_ID,
  clientName: 'ChatGPT',
  resource: RESOURCE,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-09-29T09:00:00Z'),
}

const inFuture = new Date(Date.now() + 60_000)

const codeToken = {
  id: 'token-code',
  kind: 'CODE' as const,
  grantId: 'grant-1',
  codeChallenge: sha256Base64Url(verifier),
  redirectUri: REDIRECT_URI,
  expiresAt: inFuture,
  consumedAt: null,
  revokedAt: null,
  grant,
}

const refreshRow = {
  ...codeToken,
  id: 'token-refresh',
  kind: 'REFRESH' as const,
  codeChallenge: null,
  redirectUri: null,
}

const findTokenByHash = vi.fn()
const consumeAndIssue = vi.fn()
const revoke = vi.fn()
const grantGw = { findTokenByHash, consumeAndIssue, revoke }

const codeGrant = (overrides: Record<string, string | undefined> = {}) => ({
  grant_type: 'authorization_code',
  code,
  code_verifier: verifier,
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  resource: RESOURCE,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  findTokenByHash.mockResolvedValue(codeToken)
  consumeAndIssue.mockResolvedValue({ issued: true })
})

describe('exchangeOAuthToken — authorization_code', () => {
  it('issues an access and refresh token pair after consuming the code', async () => {
    const result = await exchangeOAuthToken(codeGrant(), grantGw)

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.tokens).toMatchObject({
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'school:admin',
    })
    expect(result.tokens.access_token).toMatch(/^edu_oat_[A-Za-z0-9_-]{43}$/)
    expect(result.tokens.refresh_token).toMatch(/^edu_ort_[A-Za-z0-9_-]{43}$/)

    expect(findTokenByHash).toHaveBeenCalledWith(hashMcpKey(code))
    const [tokenId, kind, grantId, , issued] = consumeAndIssue.mock.calls[0]
    expect([tokenId, kind, grantId]).toEqual(['token-code', 'CODE', 'grant-1'])
    expect(issued.access.tokenHash).toBe(hashMcpKey(result.tokens.access_token))
    expect(issued.refresh.tokenHash).toBe(hashMcpKey(result.tokens.refresh_token))
    expect(JSON.stringify(issued)).not.toContain(result.tokens.access_token)
  })

  it('refuses a wrong PKCE verifier without consuming anything', async () => {
    const result = await exchangeOAuthToken(codeGrant({ code_verifier: 'w'.repeat(43) }), grantGw)

    expect(result).toEqual({ status: 'invalid_grant' })
    expect(consumeAndIssue).not.toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
  })

  it('refuses a code presented by another client', async () => {
    const result = await exchangeOAuthToken(codeGrant({ client_id: OTHER_CLIENT_ID }), grantGw)

    expect(result).toEqual({ status: 'invalid_client' })
    expect(consumeAndIssue).not.toHaveBeenCalled()
  })

  it('refuses a redirect_uri that differs from the one the code was born with', async () => {
    const result = await exchangeOAuthToken(
      codeGrant({ redirect_uri: 'https://chatgpt.com/other' }),
      grantGw
    )

    expect(result).toEqual({ status: 'invalid_grant' })
  })

  it('refuses a resource that is not the grant audience', async () => {
    const result = await exchangeOAuthToken(
      codeGrant({ resource: 'https://ecole-b.example/api/mcp' }),
      grantGw
    )

    expect(result).toEqual({ status: 'invalid_target' })
    expect(consumeAndIssue).not.toHaveBeenCalled()
  })

  it('accepts the resource with a trailing slash', async () => {
    const result = await exchangeOAuthToken(codeGrant({ resource: `${RESOURCE}/` }), grantGw)

    expect(result.status).toBe('OK')
  })

  it('revokes the whole grant when a consumed code is replayed', async () => {
    findTokenByHash.mockResolvedValue({ ...codeToken, consumedAt: new Date() })

    const result = await exchangeOAuthToken(codeGrant(), grantGw)

    expect(result).toEqual({ status: 'invalid_grant' })
    expect(revoke).toHaveBeenCalledWith('grant-1', 'school-1', expect.any(Date))
    expect(consumeAndIssue).not.toHaveBeenCalled()
  })

  it('refuses an expired code without touching the grant', async () => {
    findTokenByHash.mockResolvedValue({ ...codeToken, expiresAt: new Date(Date.now() - 1) })

    expect(await exchangeOAuthToken(codeGrant(), grantGw)).toEqual({ status: 'invalid_grant' })
    expect(revoke).not.toHaveBeenCalled()
  })

  it('refuses a code of a revoked grant', async () => {
    findTokenByHash.mockResolvedValue({ ...codeToken, grant: { ...grant, revokedAt: new Date() } })

    expect(await exchangeOAuthToken(codeGrant(), grantGw)).toEqual({ status: 'invalid_grant' })
    expect(revoke).not.toHaveBeenCalled()
  })

  it('refuses an unknown code or a secret of another kind', async () => {
    findTokenByHash.mockResolvedValue(null)
    expect(await exchangeOAuthToken(codeGrant(), grantGw)).toEqual({ status: 'invalid_grant' })

    findTokenByHash.mockResolvedValue(refreshRow)
    expect(await exchangeOAuthToken(codeGrant(), grantGw)).toEqual({ status: 'invalid_grant' })
  })

  it('refuses the loser of a concurrent exchange without revoking on its own', async () => {
    consumeAndIssue.mockResolvedValue(null)

    expect(await exchangeOAuthToken(codeGrant(), grantGw)).toEqual({ status: 'invalid_grant' })
  })

  it('rejects a malformed request before any lookup', async () => {
    expect(await exchangeOAuthToken(codeGrant({ code: 'nope' }), grantGw)).toEqual({
      status: 'invalid_request',
    })
    expect(await exchangeOAuthToken(codeGrant({ code_verifier: undefined }), grantGw)).toEqual({
      status: 'invalid_request',
    })
    expect(findTokenByHash).not.toHaveBeenCalled()
  })
})

describe('exchangeOAuthToken — refresh_token', () => {
  const refreshGrant = (overrides: Record<string, string | undefined> = {}) => ({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    ...overrides,
  })

  beforeEach(() => {
    findTokenByHash.mockResolvedValue(refreshRow)
  })

  it('rotates the refresh token while issuing a fresh access token', async () => {
    const result = await exchangeOAuthToken(refreshGrant(), grantGw)

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.tokens.refresh_token).not.toBe(refreshToken)
    expect(consumeAndIssue).toHaveBeenCalledWith(
      'token-refresh',
      'REFRESH',
      'grant-1',
      expect.any(Date),
      expect.objectContaining({ access: expect.anything(), refresh: expect.anything() })
    )
  })

  it('revokes the grant when a rotated refresh token comes back', async () => {
    findTokenByHash.mockResolvedValue({ ...refreshRow, consumedAt: new Date() })

    expect(await exchangeOAuthToken(refreshGrant(), grantGw)).toEqual({ status: 'invalid_grant' })
    expect(revoke).toHaveBeenCalledWith('grant-1', 'school-1', expect.any(Date))
  })

  it('refuses a refresh token of another client or another site', async () => {
    expect(await exchangeOAuthToken(refreshGrant({ client_id: OTHER_CLIENT_ID }), grantGw)).toEqual(
      {
        status: 'invalid_client',
      }
    )
    expect(
      await exchangeOAuthToken(
        refreshGrant({ resource: 'https://ecole-b.example/api/mcp' }),
        grantGw
      )
    ).toEqual({ status: 'invalid_target' })
    expect(consumeAndIssue).not.toHaveBeenCalled()
  })

  it('refuses an access token presented as a refresh token', async () => {
    expect(
      await exchangeOAuthToken(
        refreshGrant({ refresh_token: `edu_oat_${'a'.repeat(43)}` }),
        grantGw
      )
    ).toEqual({ status: 'invalid_request' })
  })
})

describe('exchangeOAuthToken — other grants', () => {
  it('names any other grant type as unsupported', async () => {
    expect(
      await exchangeOAuthToken({ grant_type: 'client_credentials', client_id: CLIENT_ID }, grantGw)
    ).toEqual({ status: 'unsupported_grant_type' })
    expect(await exchangeOAuthToken({}, grantGw)).toEqual({ status: 'unsupported_grant_type' })
  })
})
