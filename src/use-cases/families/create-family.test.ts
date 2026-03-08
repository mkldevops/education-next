import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  create: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

const { createFamily } = await import('./create-family')

describe('createFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.create = vi.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
  })

  it('should fail validation with invalid input', async () => {
    const result = await createFamily({
      name: '',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name exceeds max length', async () => {
    const longName = 'a'.repeat(51)
    const result = await createFamily({
      name: longName,
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail when name is only whitespace', async () => {
    const result = await createFamily({
      name: '   ',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should succeed with valid family name', async () => {
    const result = await createFamily({
      name: 'Dupont Family',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })

  it('should create family with provided name', async () => {
    await createFamily({
      name: 'Martin Family',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Martin Family',
      })
    )
  })

  it('should create family with createdById', async () => {
    const createdById = '550e8400-e29b-41d4-a716-446655440001'
    await createFamily({
      name: 'Silva Family',
      createdById,
    })

    expect(familyGatewayMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById,
      })
    )
  })

  it('should create family with optional emergency contact', async () => {
    await createFamily({
      name: 'Garcia Family',
      emergencyContact: 'Emergency contact info',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        emergencyContact: 'Emergency contact info',
      })
    )
  })

  it('should create family with optional authorized pickup', async () => {
    await createFamily({
      name: 'Lopez Family',
      authorizedPickup: 'John Doe',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizedPickup: 'John Doe',
      })
    )
  })

  it('should return created family', async () => {
    const result = await createFamily({
      name: 'Torres Family',
      emergencyContact: 'Contact',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })
})
