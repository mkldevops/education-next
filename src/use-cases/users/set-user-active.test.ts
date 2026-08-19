import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  countActiveSuperAdmins: vi.fn(),
  setActive: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

const { deactivateUser, reactivateUser } = await import('./set-user-active')

const actor = { id: 'cm0actor00000000000000000', role: 'SUPER_ADMIN' as const }
const targetId = 'cm0target0000000000000000'

describe('deactivateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(2)
  })

  it('rejects an invalid id', async () => {
    expect(await deactivateUser(actor, { id: 'nope' })).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await deactivateUser(actor, { id: targetId })).toBe('notFound')
  })

  it('refuses an already archived user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: false })
    expect(await deactivateUser(actor, { id: targetId })).toBe('alreadyInactive')
  })

  it('refuses to archive the last super admin', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      role: 'SUPER_ADMIN',
      isActive: true,
    })
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(1)
    expect(await deactivateUser(actor, { id: targetId })).toBe('lastSuperAdmin')
    expect(userGatewayMock.setActive).not.toHaveBeenCalled()
  })

  it('archives the user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: true })
    expect(await deactivateUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.setActive).toHaveBeenCalledWith(targetId, false)
  })
})

describe('reactivateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses an already active user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: true })
    expect(await reactivateUser(actor, { id: targetId })).toBe('alreadyActive')
  })

  it('restores an archived user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: false })
    expect(await reactivateUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.setActive).toHaveBeenCalledWith(targetId, true)
  })
})
