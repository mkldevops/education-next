import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const revokeMcpOAuthGrantMock = vi.fn()
const revalidatePathMock = vi.fn()
const isImpersonatingRequestMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/impersonation-guard', () => ({
  isImpersonatingRequest: isImpersonatingRequestMock,
}))
vi.mock('../../../_lib/auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('@/use-cases/mcp/oauth/grants', () => ({ revokeMcpOAuthGrant: revokeMcpOAuthGrantMock }))

const { revokeMcpOAuthGrantAction } = await import('./mcp-oauth-grant-actions')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-1', userId: 'user-1' })
  isImpersonatingRequestMock.mockResolvedValue(false)
  revokeMcpOAuthGrantMock.mockResolvedValue('OK')
})

describe('revokeMcpOAuthGrantAction', () => {
  it('opens on the school admin guard before any work', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(revokeMcpOAuthGrantAction('grant-1')).rejects.toThrow('notFound')
    expect(revokeMcpOAuthGrantMock).not.toHaveBeenCalled()
  })

  it('scopes the revocation to the authenticated holder and school', async () => {
    expect(await revokeMcpOAuthGrantAction('grant-1')).toBe('OK')
    expect(revokeMcpOAuthGrantMock).toHaveBeenCalledWith('grant-1', 'user-1', 'school-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/settings')
  })

  it('forwards a miss without revalidating', async () => {
    revokeMcpOAuthGrantMock.mockResolvedValue('notFound')

    expect(await revokeMcpOAuthGrantAction('grant-1')).toBe('notFound')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('refuses to revoke a connection under a borrowed identity', async () => {
    isImpersonatingRequestMock.mockResolvedValue(true)

    expect(await revokeMcpOAuthGrantAction('grant-1')).toBe('impersonating')
    expect(revokeMcpOAuthGrantMock).not.toHaveBeenCalled()
  })
})
