import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const isMcpEnabledMock = vi.fn()
const createMcpApiKeyMock = vi.fn()
const revokeMcpApiKeyMock = vi.fn()
const revalidatePathMock = vi.fn()
const isImpersonatingRequestMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/impersonation-guard', () => ({
  isImpersonatingRequest: isImpersonatingRequestMock,
}))
vi.mock('../../../_lib/auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('@/use-cases/platform-settings/is-mcp-enabled', () => ({ isMcpEnabled: isMcpEnabledMock }))
vi.mock('@/use-cases/mcp/create-mcp-api-key', () => ({ createMcpApiKey: createMcpApiKeyMock }))
vi.mock('@/use-cases/mcp/revoke-mcp-api-key', () => ({ revokeMcpApiKey: revokeMcpApiKeyMock }))

const { createMcpApiKeyAction, revokeMcpApiKeyAction } = await import('./mcp-api-key-actions')

const record = {
  id: 'key-1',
  name: 'Poste de Fatima',
  prefix: 'edu_mcp_aaaa',
  lastUsedAt: null,
  expiresAt: new Date('2026-12-10T12:00:00Z'),
  revokedAt: null,
  createdAt: new Date('2026-09-11T12:00:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-1', userId: 'user-1' })
  isMcpEnabledMock.mockResolvedValue(true)
  isImpersonatingRequestMock.mockResolvedValue(false)
  createMcpApiKeyMock.mockResolvedValue({ key: 'edu_mcp_secret', record })
  revokeMcpApiKeyMock.mockResolvedValue('OK')
})

describe('createMcpApiKeyAction', () => {
  it('opens on the school admin guard before any work', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(createMcpApiKeyAction({ name: 'x', lifetimeDays: 90 })).rejects.toThrow('notFound')
    expect(createMcpApiKeyMock).not.toHaveBeenCalled()
  })

  it('refuses to mint a key for a server that is switched off', async () => {
    isMcpEnabledMock.mockResolvedValue(false)

    expect(await createMcpApiKeyAction({ name: 'x', lifetimeDays: 90 })).toBe('mcpDisabled')
    expect(createMcpApiKeyMock).not.toHaveBeenCalled()
  })

  it('injects the authenticated identity and school, never a caller-supplied one', async () => {
    await createMcpApiKeyAction({
      name: 'Poste de Fatima',
      lifetimeDays: 90,
      // @ts-expect-error the client cannot choose its own school
      schoolId: 'school-2',
    })

    expect(createMcpApiKeyMock).toHaveBeenCalledWith({
      name: 'Poste de Fatima',
      lifetimeDays: 90,
      userId: 'user-1',
      schoolId: 'school-1',
    })
  })

  it('returns the plaintext key once, alongside a serialisable record', async () => {
    const result = await createMcpApiKeyAction({ name: 'Poste de Fatima', lifetimeDays: 90 })

    expect(result).toEqual({
      key: 'edu_mcp_secret',
      record: {
        id: 'key-1',
        name: 'Poste de Fatima',
        prefix: 'edu_mcp_aaaa',
        lastUsedAt: null,
        expiresAt: '2026-12-10T12:00:00.000Z',
        revokedAt: null,
        createdAt: '2026-09-11T12:00:00.000Z',
      },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/settings')
  })

  it('forwards a refusal without revalidating', async () => {
    createMcpApiKeyMock.mockResolvedValue('tooManyKeys')

    expect(await createMcpApiKeyAction({ name: 'x', lifetimeDays: 90 })).toBe('tooManyKeys')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('revokeMcpApiKeyAction', () => {
  it('scopes the revocation to the authenticated holder and school', async () => {
    expect(await revokeMcpApiKeyAction('key-1')).toBe('OK')
    expect(revokeMcpApiKeyMock).toHaveBeenCalledWith('key-1', 'user-1', 'school-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/settings')
  })

  it('forwards a miss without revalidating', async () => {
    revokeMcpApiKeyMock.mockResolvedValue('notFound')

    expect(await revokeMcpApiKeyAction('key-1')).toBe('notFound')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('MCP keys while impersonating', () => {
  beforeEach(() => {
    isImpersonatingRequestMock.mockResolvedValue(true)
  })

  it('refuses to mint a key under the borrowed identity', async () => {
    expect(await createMcpApiKeyAction({ name: 'x', lifetimeDays: 90 })).toBe('impersonating')
    expect(createMcpApiKeyMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('refuses to revoke a key under the borrowed identity', async () => {
    expect(await revokeMcpApiKeyAction('key-1')).toBe('impersonating')
    expect(revokeMcpApiKeyMock).not.toHaveBeenCalled()
  })
})
