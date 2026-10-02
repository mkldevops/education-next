import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { revokeOAuthToken } from './revoke-token'

const accessToken = `edu_oat_${'a'.repeat(43)}`
const refreshToken = `edu_ort_${'r'.repeat(43)}`
const clientId = 'client-1'
const revokeAs = (token: string | undefined, client: string | undefined = clientId) =>
  revokeOAuthToken({ token, clientId: client }, grantGw)

const row = {
  id: 'token-1',
  kind: 'ACCESS' as const,
  grantId: 'grant-1',
  codeChallenge: null,
  redirectUri: null,
  expiresAt: new Date(Date.now() + 1000),
  consumedAt: null,
  revokedAt: null,
  grant: { id: 'grant-1', schoolId: 'school-1', clientId, revokedAt: null },
}

const findTokenByHash = vi.fn()
const revoke = vi.fn()
const grantGw = { findTokenByHash, revoke } as unknown as Parameters<typeof revokeOAuthToken>[1]

beforeEach(() => {
  vi.clearAllMocks()
  findTokenByHash.mockResolvedValue(row)
})

describe('revokeOAuthToken', () => {
  it('revokes the whole grant behind an access or refresh token', async () => {
    expect(await revokeAs(accessToken)).toBe('OK')
    expect(findTokenByHash).toHaveBeenCalledWith(hashMcpKey(accessToken))
    expect(revoke).toHaveBeenCalledWith('grant-1', 'school-1', expect.any(Date))

    findTokenByHash.mockResolvedValue({ ...row, kind: 'REFRESH' })
    expect(await revokeAs(refreshToken)).toBe('OK')
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('answers OK for an unknown, malformed or missing token without revealing anything', async () => {
    findTokenByHash.mockResolvedValue(null)

    expect(await revokeAs(accessToken)).toBe('OK')
    expect(await revokeAs('garbage')).toBe('OK')
    expect(await revokeAs(undefined)).toBe('OK')
    expect(findTokenByHash).toHaveBeenCalledTimes(1)
    expect(revoke).not.toHaveBeenCalled()
  })

  it('ignores an authorization code presented for revocation', async () => {
    findTokenByHash.mockResolvedValue({ ...row, kind: 'CODE' })

    expect(await revokeAs(accessToken)).toBe('OK')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('refuses a request without client_id before looking the token up', async () => {
    expect(await revokeOAuthToken({ token: accessToken, clientId: undefined }, grantGw)).toBe(
      'invalid_client'
    )
    expect(await revokeAs(accessToken, '')).toBe('invalid_client')
    expect(findTokenByHash).not.toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
  })

  it("refuses to revoke another client's connection", async () => {
    expect(await revokeAs(accessToken, 'client-2')).toBe('invalid_client')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('answers OK for an unknown token whatever the client', async () => {
    findTokenByHash.mockResolvedValue(null)

    expect(await revokeAs(accessToken, 'client-2')).toBe('OK')
  })
})
