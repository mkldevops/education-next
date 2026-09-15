import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCP_KEY_PREFIX } from '@/domain/mcp-key'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { resolveMcpScope } from './resolve-mcp-scope'

const presented = `${MCP_KEY_PREFIX}${'a'.repeat(43)}`

const liveKey = {
  id: 'key-1',
  schoolId: 'school-1',
  userId: 'user-1',
  prefix: 'edu_mcp_aaaa',
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  lastUsedAt: null,
}

const findByHash = vi.fn()
const findPlatformLevel = vi.fn()
const findActiveById = vi.fn()
const findMembership = vi.fn()
const checkPaymentsEnabled = vi.fn()

const deps = {
  keyGw: { findByHash },
  userGw: { findPlatformLevel },
  schoolGw: { findActiveById },
  memberGw: { findMembership },
  checkPaymentsEnabled,
}

const resolve = (key: string | null) => resolveMcpScope(key, deps)

beforeEach(() => {
  vi.clearAllMocks()
  findByHash.mockResolvedValue(liveKey)
  findPlatformLevel.mockResolvedValue({ id: 'user-1', isSuperAdmin: false })
  findActiveById.mockResolvedValue({ id: 'school-1', name: 'École', slug: 'ecole' })
  findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-1', role: 'ADMIN' })
  checkPaymentsEnabled.mockResolvedValue(true)
})

describe('resolveMcpScope', () => {
  it('refuses a missing or malformed credential without touching the database', async () => {
    for (const candidate of [
      null,
      '',
      'Bearer',
      'edu_mcp_short',
      `${MCP_KEY_PREFIX}${'a'.repeat(44)}`,
    ]) {
      expect(await resolve(candidate)).toEqual({ status: 'unauthenticated' })
    }
    expect(findByHash).not.toHaveBeenCalled()
  })

  it('looks the key up by its hash, never by the key itself', async () => {
    await resolve(presented)

    expect(findByHash).toHaveBeenCalledWith(hashMcpKey(presented))
    expect(findByHash).not.toHaveBeenCalledWith(presented)
  })

  it('resolves an admin of the key school', async () => {
    expect(await resolve(presented)).toEqual({
      status: 'OK',
      scope: {
        keyId: 'key-1',
        keyPrefix: 'edu_mcp_aaaa',
        userId: 'user-1',
        schoolId: 'school-1',
        isSuperAdmin: false,
        paymentsEnabled: true,
      },
    })
  })

  it('carries the payments flag resolved once for the request, whichever way it reads', async () => {
    checkPaymentsEnabled.mockResolvedValue(false)

    expect(await resolve(presented)).toMatchObject({ scope: { paymentsEnabled: false } })
    expect(checkPaymentsEnabled).toHaveBeenCalledTimes(1)
    expect(checkPaymentsEnabled).toHaveBeenCalledWith('school-1')
  })

  it('refuses an unknown key the same way as a malformed one', async () => {
    findByHash.mockResolvedValue(null)

    expect(await resolve(presented)).toEqual({ status: 'unauthenticated' })
  })

  it('refuses a revoked key, and an expired one, indistinguishably', async () => {
    findByHash.mockResolvedValue({ ...liveKey, revokedAt: new Date() })
    expect(await resolve(presented)).toEqual({ status: 'unauthenticated' })

    findByHash.mockResolvedValue({ ...liveKey, expiresAt: new Date(Date.now() - 1000) })
    expect(await resolve(presented)).toEqual({ status: 'unauthenticated' })
  })

  it('treats a deactivated account as revoking every key it issued', async () => {
    findPlatformLevel.mockResolvedValue(null)

    expect(await resolve(presented)).toEqual({ status: 'forbidden' })
    expect(findMembership).not.toHaveBeenCalled()
  })

  it('refuses a key whose school has been deactivated', async () => {
    findActiveById.mockResolvedValue(null)

    expect(await resolve(presented)).toEqual({ status: 'forbidden' })
  })

  it('admits a super admin without reading a membership', async () => {
    findPlatformLevel.mockResolvedValue({ id: 'user-1', isSuperAdmin: true })

    expect(await resolve(presented)).toMatchObject({
      status: 'OK',
      scope: { isSuperAdmin: true, schoolId: 'school-1' },
    })
    expect(findMembership).not.toHaveBeenCalled()
  })

  it('refuses a parent, and a member whose role was withdrawn', async () => {
    findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-1', role: 'PARENT' })
    expect(await resolve(presented)).toEqual({ status: 'forbidden' })

    findMembership.mockResolvedValue(null)
    expect(await resolve(presented)).toEqual({ status: 'forbidden' })
  })

  it('scopes the caller to the school recorded on the key, not to a requested one', async () => {
    findByHash.mockResolvedValue({ ...liveKey, schoolId: 'school-2' })
    findMembership.mockResolvedValue({ userId: 'user-1', schoolId: 'school-2', role: 'ADMIN' })

    expect(await resolve(presented)).toMatchObject({ scope: { schoolId: 'school-2' } })
    expect(findMembership).toHaveBeenCalledWith('user-1', 'school-2')
  })
})
