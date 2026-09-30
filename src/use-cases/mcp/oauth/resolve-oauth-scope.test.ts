import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { resolveMcpOAuthScope } from './resolve-oauth-scope'

const SITE_A = 'https://ecole-a.example'
const SITE_B = 'https://ecole-b.example'

const accessToken = `edu_oat_${'a'.repeat(43)}`

const grant = {
  id: 'grant-1',
  schoolId: 'school-1',
  userId: 'user-1',
  clientId: '4d5c0a4a-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  clientName: 'ChatGPT',
  resource: `${SITE_A}/api/mcp`,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-09-29T09:00:00Z'),
}

const liveToken = {
  id: 'token-access',
  kind: 'ACCESS' as const,
  grantId: 'grant-1',
  codeChallenge: null,
  redirectUri: null,
  expiresAt: new Date(Date.now() + 3_600_000),
  consumedAt: null,
  revokedAt: null,
  grant,
}

const findTokenByHash = vi.fn()
const findPlatformLevel = vi.fn()
const findActiveById = vi.fn()
const findMembership = vi.fn()
const checkPaymentsEnabled = vi.fn()

const resolve = (token: string, origin = SITE_A) =>
  resolveMcpOAuthScope(token, {
    grantGw: { findTokenByHash },
    userGw: { findPlatformLevel },
    schoolGw: { findActiveById },
    memberGw: { findMembership },
    checkPaymentsEnabled,
    origin,
  })

beforeEach(() => {
  vi.clearAllMocks()
  findTokenByHash.mockResolvedValue(liveToken)
  findPlatformLevel.mockResolvedValue({ id: 'user-1', isSuperAdmin: false })
  findActiveById.mockResolvedValue({ id: 'school-1', name: 'École A', slug: 'ecole-a' })
  findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-1', role: 'ADMIN' })
  checkPaymentsEnabled.mockResolvedValue(true)
})

describe('resolveMcpOAuthScope', () => {
  it('resolves an admin of the granted school, scoped to the grant', async () => {
    expect(await resolve(accessToken)).toEqual({
      status: 'OK',
      scope: {
        credentialId: 'grant-1',
        credentialPrefix: 'edu_oat_aaaa',
        owner: { kind: 'OAUTH_GRANT', grantId: 'grant-1' },
        userId: 'user-1',
        schoolId: 'school-1',
        isSuperAdmin: false,
        paymentsEnabled: true,
      },
    })
    expect(findTokenByHash).toHaveBeenCalledWith(hashMcpKey(accessToken))
    expect(findMembership).toHaveBeenCalledWith('user-1', 'school-1')
  })

  it('refuses a malformed token without a lookup', async () => {
    for (const candidate of [
      '',
      'edu_oat_short',
      `edu_ort_${'a'.repeat(43)}`,
      `edu_mcp_${'a'.repeat(43)}`,
    ]) {
      expect(await resolve(candidate)).toEqual({ status: 'unauthenticated' })
    }
    expect(findTokenByHash).not.toHaveBeenCalled()
  })

  it('refuses an unknown, expired or revoked token', async () => {
    findTokenByHash.mockResolvedValueOnce(null)
    expect(await resolve(accessToken)).toEqual({ status: 'unauthenticated' })

    findTokenByHash.mockResolvedValueOnce({ ...liveToken, expiresAt: new Date(Date.now() - 1) })
    expect(await resolve(accessToken)).toEqual({ status: 'unauthenticated' })

    findTokenByHash.mockResolvedValueOnce({ ...liveToken, revokedAt: new Date() })
    expect(await resolve(accessToken)).toEqual({ status: 'unauthenticated' })
    expect(findPlatformLevel).not.toHaveBeenCalled()
  })

  it('refuses a refresh token or code row even when its hash matches', async () => {
    findTokenByHash.mockResolvedValue({ ...liveToken, kind: 'REFRESH' })

    expect(await resolve(accessToken)).toEqual({ status: 'unauthenticated' })
  })

  it('refuses a live access token once its grant is revoked', async () => {
    findTokenByHash.mockResolvedValue({ ...liveToken, grant: { ...grant, revokedAt: new Date() } })

    expect(await resolve(accessToken)).toEqual({ status: 'unauthenticated' })
    expect(findPlatformLevel).not.toHaveBeenCalled()
  })

  it('refuses a token issued by site A when presented to site B', async () => {
    expect(await resolve(accessToken, SITE_B)).toEqual({ status: 'unauthenticated' })
    expect(findPlatformLevel).not.toHaveBeenCalled()
    expect(findActiveById).not.toHaveBeenCalled()
  })

  it('forbids a user that no longer exists', async () => {
    findPlatformLevel.mockResolvedValue(null)

    expect(await resolve(accessToken)).toEqual({ status: 'forbidden' })
  })

  it('forbids a grant on a deactivated school', async () => {
    findActiveById.mockResolvedValue(null)

    expect(await resolve(accessToken)).toEqual({ status: 'forbidden' })
    expect(findMembership).not.toHaveBeenCalled()
  })

  it.each([
    ['a parent', { userId: 'user-1', schoolId: 'school-1', role: 'PARENT' }],
    ['a teacher', { userId: 'user-1', schoolId: 'school-1', role: 'TEACHER' }],
    ['a user of another school', null],
  ])('forbids %s on every call, even with a valid token', async (_label, membership) => {
    findMembership.mockResolvedValue(membership)

    expect(await resolve(accessToken)).toEqual({ status: 'forbidden' })
  })

  it('lets a super admin in without a membership', async () => {
    findPlatformLevel.mockResolvedValue({ id: 'user-1', isSuperAdmin: true })
    findMembership.mockResolvedValue(null)

    const result = await resolve(accessToken)

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.scope.isSuperAdmin).toBe(true)
    expect(findMembership).not.toHaveBeenCalled()
  })

  it('carries the school payments flag', async () => {
    checkPaymentsEnabled.mockResolvedValue(false)

    const result = await resolve(accessToken)

    expect(result.status).toBe('OK')
    if (result.status !== 'OK') return
    expect(result.scope.paymentsEnabled).toBe(false)
    expect(checkPaymentsEnabled).toHaveBeenCalledWith('school-1')
  })
})
