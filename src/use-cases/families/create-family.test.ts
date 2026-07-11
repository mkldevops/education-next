import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  createWithParents: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

const { createFamily } = await import('./create-family')

const aParent = { name: 'Jean', lastname: 'Dupont', sex: 'MALE' as const }

describe('createFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.createWithParents = vi.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
  })

  it('should fail validation with invalid input', async () => {
    const result = await createFamily({
      name: '',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name exceeds max length', async () => {
    const longName = 'a'.repeat(51)
    const result = await createFamily({
      name: longName,
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail when name is only whitespace', async () => {
    const result = await createFamily({
      name: '   ',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation without any parent', async () => {
    const result = await createFamily({
      name: 'Dupont Family',
      parents: [],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when a parent has no lastname', async () => {
    const result = await createFamily({
      name: 'Dupont Family',
      parents: [{ name: 'Jean', lastname: '', sex: 'MALE' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should succeed with valid family name', async () => {
    const result = await createFamily({
      name: 'Dupont Family',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })

  it('should create family with provided name', async () => {
    await createFamily({
      name: 'Martin Family',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Martin Family',
      })
    )
  })

  it('should create family with createdById', async () => {
    const createdById = '550e8400-e29b-41d4-a716-446655440001'
    await createFamily({
      name: 'Silva Family',
      parents: [aParent],
      createdById,
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById,
      })
    )
  })

  it('should create family with optional emergency contact', async () => {
    await createFamily({
      name: 'Garcia Family',
      emergencyContact: 'Emergency contact info',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      expect.objectContaining({
        emergencyContact: 'Emergency contact info',
      })
    )
  })

  it('should copy shared address to each parent', async () => {
    await createFamily({
      name: 'Lopez Family',
      parents: [aParent, { name: 'Marie', lastname: 'Lopez', sex: 'FEMALE' }],
      address: '1 rue de la Paix',
      postCode: '75001',
      city: 'Paris',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      expect.objectContaining({
        parents: [
          expect.objectContaining({
            name: 'Jean',
            address: '1 rue de la Paix',
            postCode: '75001',
            city: 'Paris',
          }),
          expect.objectContaining({
            name: 'Marie',
            address: '1 rue de la Paix',
            postCode: '75001',
            city: 'Paris',
          }),
        ],
      })
    )
  })

  it('should pass parent phone number to gateway', async () => {
    await createFamily({
      name: 'Torres Family',
      parents: [{ ...aParent, phoneNumber: '0612345678' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      expect.objectContaining({
        parents: [expect.objectContaining({ phoneNumber: '0612345678' })],
      })
    )
  })

  it('should return created family', async () => {
    const result = await createFamily({
      name: 'Torres Family',
      emergencyContact: 'Contact',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })
})
