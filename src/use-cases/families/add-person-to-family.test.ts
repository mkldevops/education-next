import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findById: vi.fn(),
  addPerson: vi.fn(),
}
const personGatewayMock = {
  create: vi.fn(),
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
    familyGatewayMock.addPerson = vi.fn()
    personGatewayMock.create = vi.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
    })
  })

  it('should fail validation with invalid input', async () => {
    const result = await addPersonToFamily({
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

  it('should fail with family not found', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)

    const result = await addPersonToFamily({
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

  it('should succeed adding parent to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
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

  it('should create person with correct data', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    await addPersonToFamily({
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
        email: 'john@example.com',
      },
      relationType: 'PARENT',
    })

    expect(personGatewayMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John',
        lastname: 'Doe',
        sex: 'MALE',
        email: 'john@example.com',
      })
    )
  })

  it('should add person to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    await addPersonToFamily({
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Jane',
        lastname: 'Doe',
        sex: 'FEMALE',
      },
      relationType: 'TUTOR',
    })

    expect(familyGatewayMock.addPerson).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      'TUTOR'
    )
  })

  it('should succeed adding grandparent to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      person: {
        name: 'Maria',
        lastname: 'Doe',
        sex: 'FEMALE',
      },
      relationType: 'GRANDPARENT',
    })

    expect(result).toHaveProperty('id')
    expect(familyGatewayMock.addPerson).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'GRANDPARENT'
    )
  })

  it('should succeed adding sibling to family', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })

    const result = await addPersonToFamily({
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
