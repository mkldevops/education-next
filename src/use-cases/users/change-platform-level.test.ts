import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  countActiveSuperAdmins: vi.fn(),
  setPlatformLevel: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

const { changePlatformLevel } = await import('./change-platform-level')

const actor = { id: 'cm0actor00000000000000000' }
const targetId = 'cm0target0000000000000000'

describe('changePlatformLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(2)
  })

  // Un identifiant Better Auth n'a pas de format contraint : seul le vide est invalide.
  it('rejects an empty id', async () => {
    const result = await changePlatformLevel(actor, { id: '', isSuperAdmin: true })
    expect(result).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    const result = await changePlatformLevel(actor, { id: targetId, isSuperAdmin: true })
    expect(result).toBe('notFound')
  })

  it('is a no-op when the platform level is unchanged', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: true,
      isActive: true,
    })
    const result = await changePlatformLevel(actor, { id: targetId, isSuperAdmin: true })
    expect(result).toBe('OK')
    expect(userGatewayMock.setPlatformLevel).not.toHaveBeenCalled()
  })

  it('refuses to act on yourself', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: actor.id,
      isSuperAdmin: true,
      isActive: true,
    })
    const result = await changePlatformLevel(actor, { id: actor.id, isSuperAdmin: false })
    expect(result).toBe('cannotTargetSelf')
  })

  it('refuses to remove the platform level from the last super admin', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: true,
      isActive: true,
    })
    userGatewayMock.countActiveSuperAdmins.mockResolvedValue(1)
    const result = await changePlatformLevel(actor, { id: targetId, isSuperAdmin: false })
    expect(result).toBe('lastSuperAdmin')
    expect(userGatewayMock.setPlatformLevel).not.toHaveBeenCalled()
  })

  it('changes the platform level', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: true,
    })
    const result = await changePlatformLevel(actor, { id: targetId, isSuperAdmin: true })
    expect(result).toBe('OK')
    expect(userGatewayMock.setPlatformLevel).toHaveBeenCalledWith(targetId, true)
  })
})
