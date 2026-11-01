import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findById: vi.fn(),
}
const personGatewayMock = {
  createWithFamily: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

vi.mock('@/gateways/person-gateway', () => ({
  personGateway: personGatewayMock,
}))

const { addPersonToFamily } = await import('./add-person-to-family')

describe('addPersonToFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findById = vi.fn()
    personGatewayMock.createWithFamily = vi.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
    })
  })

  it('should fail validation with invalid input', async () => {
    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: 'invalid-uuid',
      person: {
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'PARENT',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when person name is empty', async () => {
    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: '',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'PARENT',
    })

    expect(result).toBe('validationError')
  })

  it('should reject a person name made only of spaces', async () => {
    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: '   ',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'PARENT',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with family not found', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)

    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'PARENT',
    })

    expect(result).toBe('notFound')
  })

  it('returns notFound if the family is archived before creation', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    personGatewayMock.createWithFamily.mockResolvedValue(null)
    expect(
      await addPersonToFamily({
        schoolId: 'school-1',
        familyId: '550e8400-e29b-41d4-a716-446655440000',
        relationType: 'PARENT',
        person: { name: 'Jane', lastname: 'Doe' },
      })
    ).toBe('notFound')
  })

  it('should succeed adding parent to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'PARENT',
    })

    expect(result).toHaveProperty('id')
  })

  it('should create person linked to family with correct data', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
        email: 'john@example.com',
      },
      relationType: 'PARENT',
    })

    expect(personGatewayMock.createWithFamily).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'PARENT',
      expect.objectContaining({
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
        email: 'john@example.com',
      }),
      undefined
    )
  })

  it('should pass address fields to gateway', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Jane',
        lastname: 'Doe',
        sex: 'FEMALE',
        address: '1 rue de la Paix',
        postCode: '75001',
        city: 'Paris',
      },
      relationType: 'TUTOR',
    })

    expect(personGatewayMock.createWithFamily).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      'TUTOR',
      expect.objectContaining({
        address: '1 rue de la Paix',
        postCode: '75001',
        city: 'Paris',
      }),
      undefined
    )
  })

  it('should pass phone number to gateway', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Jane',
        lastname: 'Doe',
        sex: 'FEMALE',
      },
      relationType: 'PARENT',
      phoneNumber: '0612345678',
    })

    expect(personGatewayMock.createWithFamily).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'PARENT',
      expect.anything(),
      '0612345678'
    )
  })

  it('should succeed adding grandparent to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Maria',
        lastname: 'Doe',
        sex: 'FEMALE',
      },
      relationType: 'GRANDPARENT',
    })

    expect(result).toHaveProperty('id')
    expect(personGatewayMock.createWithFamily).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'GRANDPARENT',
      expect.anything(),
      undefined
    )
  })

  it('should succeed adding sibling to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Tom',
        lastname: 'Doe',
        sex: 'MALE',
      },
      relationType: 'SIBLING',
    })

    expect(result).toHaveProperty('id')
  })

  it('should return created person', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
      schoolId: 'school-1',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Alice',
        lastname: 'Smith',
        sex: 'FEMALE',
      },
      relationType: 'OTHER',
    })

    expect(result).toHaveProperty('id')
  })
})
