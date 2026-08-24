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
      schoolId: 'school-1',
      name: '',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name exceeds max length', async () => {
    const longName = 'a'.repeat(51)
    const result = await createFamily({
      schoolId: 'school-1',
      name: longName,
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail when name is only whitespace', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: '   ',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should create a family before adding parents', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Dupont Family',
      parents: [],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ parents: [] })
    )
  })

  it('should fail validation when a parent has no lastname', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Dupont Family',
      parents: [{ name: 'Jean', lastname: '', sex: 'MALE' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should succeed with valid family name', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Dupont Family',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })

  it('should create family with provided name', async () => {
    await createFamily({
      schoolId: 'school-1',
      name: 'Martin Family',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        name: 'Martin Family',
      })
    )
  })

  it('should create family with createdById', async () => {
    const createdById = '550e8400-e29b-41d4-a716-446655440001'
    await createFamily({
      schoolId: 'school-1',
      name: 'Silva Family',
      parents: [aParent],
      createdById,
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        createdById,
      })
    )
  })

  it('should create family with optional emergency contact', async () => {
    await createFamily({
      schoolId: 'school-1',
      name: 'Garcia Family',
      emergencyContactName: 'Marie Garcia',
      emergencyContactPhone: '06 12 34 56 78',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        emergencyContactName: 'Marie Garcia',
        emergencyContactPhone: '06 12 34 56 78',
      })
    )
  })

  it('should fail validation when the emergency contact phone has an invalid format', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Garcia Family',
      emergencyContactName: 'Marie Garcia',
      emergencyContactPhone: 'Fahari',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should accept an emergency contact name without a phone', async () => {
    await createFamily({
      schoolId: 'school-1',
      name: 'Garcia Family',
      emergencyContactName: 'Marie Garcia',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.not.objectContaining({ emergencyContactPhone: expect.anything() })
    )
    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ emergencyContactName: 'Marie Garcia' })
    )
  })

  it('should copy shared address to each parent', async () => {
    await createFamily({
      schoolId: 'school-1',
      name: 'Lopez Family',
      parents: [aParent, { name: 'Marie', lastname: 'Lopez', sex: 'FEMALE' }],
      address: '1 rue de la Paix',
      postCode: '75001',
      city: 'Paris',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
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
      schoolId: 'school-1',
      name: 'Torres Family',
      parents: [{ ...aParent, phoneNumber: '0612345678' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        parents: [expect.objectContaining({ phoneNumber: '0612345678' })],
      })
    )
  })

  it('should fail validation when a parent phone has an invalid format', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Torres Family',
      parents: [{ ...aParent, phoneNumber: 'abc' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should accept an international parent phone format', async () => {
    await createFamily({
      schoolId: 'school-1',
      name: 'Torres Family',
      parents: [{ ...aParent, phoneNumber: '+33 6 12 34 56 78' }],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.createWithParents).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        parents: [expect.objectContaining({ phoneNumber: '+33 6 12 34 56 78' })],
      })
    )
  })

  it('should return created family', async () => {
    const result = await createFamily({
      schoolId: 'school-1',
      name: 'Torres Family',
      emergencyContactName: 'Contact',
      parents: [aParent],
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
  })
})
