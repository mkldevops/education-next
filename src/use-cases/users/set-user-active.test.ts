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

const actor = { id: 'cm0actor00000000000000000' }
const targetId = 'cm0target0000000000000000'

describe('deactivateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(2)
  })

  it('rejects an empty id', async () => {
    expect(await deactivateUser(actor, { id: '' })).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await deactivateUser(actor, { id: targetId })).toBe('notFound')
  })

  it('refuses an already archived user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: false,
    })
    expect(await deactivateUser(actor, { id: targetId })).toBe('alreadyInactive')
  })

  it('refuses to archive the last super admin', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: true,
      isActive: true,
    })
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(1)
    expect(await deactivateUser(actor, { id: targetId })).toBe('lastSuperAdmin')
    expect(userGatewayMock.setActive).not.toHaveBeenCalled()
  })

  it('archives the user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: true,
    })
    expect(await deactivateUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.setActive).toHaveBeenCalledWith(targetId, false)
  })
})

describe('reactivateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses an already active user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: true,
    })
    expect(await reactivateUser(actor, { id: targetId })).toBe('alreadyActive')
  })

  it('restores an archived user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: false,
    })
    expect(await reactivateUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.setActive).toHaveBeenCalledWith(targetId, true)
  })
})
