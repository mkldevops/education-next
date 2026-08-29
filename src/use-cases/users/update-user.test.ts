import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  findByEmail: vi.fn(),
  update: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

const { updateUser } = await import('./update-user')

const targetId = 'cm0target0000000000000000'

describe('updateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.findByEmail.mockResolvedValue(null)
    userGatewayMock.update.mockResolvedValue({ id: targetId })
  })

  it('rejects an invalid email', async () => {
    expect(await updateUser({ id: targetId, email: 'nope' })).toBe('validationError')
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await updateUser({ id: targetId, name: 'Ana' })).toBe('notFound')
  })

  it('refuses an email already taken', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'old@test.fr' })
    userGatewayMock.findByEmail.mockResolvedValue({ id: 'other' })
    expect(await updateUser({ id: targetId, email: 'taken@test.fr' })).toBe('emailAlreadyUsed')
    expect(userGatewayMock.update).not.toHaveBeenCalled()
  })

  it('keeps the same email without a uniqueness check', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'same@test.fr' })
    await updateUser({ id: targetId, email: 'same@test.fr', name: 'Ana' })
    expect(userGatewayMock.findByEmail).not.toHaveBeenCalled()
    expect(userGatewayMock.update).toHaveBeenCalled()
  })

  it('writes the address in lower case', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'old@test.fr' })
    await updateUser({ id: targetId, email: 'New@Test.FR' })
    expect(userGatewayMock.update).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({ email: 'new@test.fr' })
    )
  })

  it('refuses a duplicate that differs only by case', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'old@test.fr' })
    userGatewayMock.findByEmail.mockImplementation(async (email: string) =>
      email === 'taken@test.fr' ? { id: 'other' } : null
    )

    expect(await updateUser({ id: targetId, email: 'Taken@Test.FR' })).toBe('emailAlreadyUsed')
    expect(userGatewayMock.update).not.toHaveBeenCalled()
  })

  it('normalizes a row written before the rule when it is edited again', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'Jean.Dupont@x.fr' })

    await updateUser({ id: targetId, email: 'Jean.Dupont@x.fr' })
    expect(userGatewayMock.update).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({ email: 'jean.dupont@x.fr' })
    )
  })

  it('updates the user', async () => {
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId, email: 'old@test.fr' })
    await updateUser({ id: targetId, name: 'Ana', email: 'new@test.fr', emailVerified: true })
    expect(userGatewayMock.update).toHaveBeenCalledWith(targetId, {
      name: 'Ana',
      email: 'new@test.fr',
      emailVerified: true,
    })
  })
})
