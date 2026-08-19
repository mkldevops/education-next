import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  countActiveSuperAdmins: vi.fn(),
  changeRole: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

const { changeUserRole } = await import('./change-user-role')

const actor = { id: 'cm0actor00000000000000000', role: 'SUPER_ADMIN' as const }
const targetId = 'cm0target0000000000000000'

describe('changeUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(2)
  })

  it('rejects an invalid id', async () => {
    const result = await changeUserRole(actor, { id: 'nope', role: 'ADMIN' })
    expect(result).toBe('validationError')
  })

  it('refuses an admin promoting to super admin', async () => {
    const result = await changeUserRole(
      { id: actor.id, role: 'ADMIN' },
      { id: targetId, role: 'SUPER_ADMIN' }
    )
    expect(result).toBe('unauthorized')
    expect(userGatewayMock.findManaged).not.toHaveBeenCalled()
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    const result = await changeUserRole(actor, { id: targetId, role: 'ADMIN' })
    expect(result).toBe('notFound')
  })

  it('is a no-op when the role is unchanged', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'ADMIN', isActive: true })
    const result = await changeUserRole(actor, { id: targetId, role: 'ADMIN' })
    expect(result).toBe('OK')
    expect(userGatewayMock.changeRole).not.toHaveBeenCalled()
  })

  it('refuses to act on yourself', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: actor.id,
      role: 'SUPER_ADMIN',
      isActive: true,
    })
    const result = await changeUserRole(actor, { id: actor.id, role: 'ADMIN' })
    expect(result).toBe('cannotTargetSelf')
  })

  it('refuses to demote the last super admin', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      role: 'SUPER_ADMIN',
      isActive: true,
    })
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(1)
    const result = await changeUserRole(actor, { id: targetId, role: 'ADMIN' })
    expect(result).toBe('lastSuperAdmin')
    expect(userGatewayMock.changeRole).not.toHaveBeenCalled()
  })

  it('changes the role', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: true })
    const result = await changeUserRole(actor, { id: targetId, role: 'ADMIN' })
    expect(result).toBe('OK')
    expect(userGatewayMock.changeRole).toHaveBeenCalledWith(targetId, 'ADMIN')
  })
})
