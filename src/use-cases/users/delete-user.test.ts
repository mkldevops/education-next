import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  delete: vi.fn(),
}

const dbUnscopedMock = {
  countRowsBlockingUserDeletion: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

vi.mock('@/lib/db-unscoped', () => ({
  countRowsBlockingUserDeletion: dbUnscopedMock.countRowsBlockingUserDeletion,
}))

const { deleteUser } = await import('./delete-user')

const actor = { id: 'cm0actor00000000000000000' }
const targetId = 'cm0target0000000000000000'

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbUnscopedMock.countRowsBlockingUserDeletion.mockResolvedValue(0)
  })

  it('rejects an empty id', async () => {
    expect(await deleteUser(actor, { id: '' })).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await deleteUser(actor, { id: targetId })).toBe('notFound')
  })

  it('requires the user to be archived first', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: true,
    })
    expect(await deleteUser(actor, { id: targetId })).toBe('stillActive')
    expect(userGatewayMock.delete).not.toHaveBeenCalled()
  })

  it('refuses a user still referenced by history', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: false,
    })
    dbUnscopedMock.countRowsBlockingUserDeletion.mockResolvedValue(3)
    expect(await deleteUser(actor, { id: targetId })).toBe('hasRelatedRecords')
    expect(userGatewayMock.delete).not.toHaveBeenCalled()
  })

  it('deletes an archived user with no history', async () => {
    userGatewayMock.findManaged.mockResolvedValue({
      id: targetId,
      isSuperAdmin: false,
      isActive: false,
    })
    expect(await deleteUser(actor, { id: targetId })).toBe('OK')
    expect(userGatewayMock.delete).toHaveBeenCalledWith(targetId)
  })
})
