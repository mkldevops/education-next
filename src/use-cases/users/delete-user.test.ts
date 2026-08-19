import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  countBlockingRelations: vi.fn(),
  delete: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

const { deleteUser } = await import('./delete-user')

const actor = { id: 'cm0actor00000000000000000', role: 'SUPER_ADMIN' as const }
const targetId = 'cm0target0000000000000000'

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.countBlockingRelations.mockResolvedValue(0)
  })

  it('rejects an invalid id', async () => {
    expect(await deleteUser(actor, { id: 'nope' })).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await deleteUser(actor, { id: targetId })).toBe('notFound')
  })

  it('requires the user to be archived first', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: true })
    expect(await deleteUser(actor, { id: targetId })).toBe('stillActive')
    expect(userGatewayMock.delete).not.toHaveBeenCalled()
  })

  it('refuses a user still referenced by history', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: false })
    userGatewayMock.countBlockingRelations.mockResolvedValue(3)
    expect(await deleteUser(actor, { id: targetId })).toBe('hasRelatedRecords')
    expect(userGatewayMock.delete).not.toHaveBeenCalled()
  })

  it('deletes an archived user with no history', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, role: 'PARENT', isActive: false })
    expect(await deleteUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.delete).toHaveBeenCalledWith(targetId)
  })
})
