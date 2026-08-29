import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findPerson: vi.fn(),
}

const personGatewayMock = {
  updateWithFamily: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

vi.mock('@/gateways/person-gateway', () => ({
  personGateway: personGatewayMock,
}))

const { updateFamilyPerson } = await import('./update-family-person')

const familyId = '550e8400-e29b-41d4-a716-446655440000'
const personId = '550e8400-e29b-41d4-a716-446655440001'

describe('updateFamilyPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findPerson = vi.fn().mockResolvedValue({ familyId, personId })
    personGatewayMock.updateWithFamily = vi.fn().mockResolvedValue({ id: personId })
  })

  it('should fail validation with an invalid person id', async () => {
    const result = await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId: 'not-a-uuid',
      name: 'Tatiana',
    })

    expect(result).toBe('validationError')
    expect(personGatewayMock.updateWithFamily).not.toHaveBeenCalled()
  })

  it('should fail validation with an invalid phone number', async () => {
    const result = await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId,
      phoneNumber: 'call me',
    })

    expect(result).toBe('validationError')
  })

  it('should fail when the person is not linked to the family', async () => {
    familyGatewayMock.findPerson.mockResolvedValue(null)

    const result = await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId,
      name: 'Tatiana',
    })

    expect(result).toBe('notFound')
    expect(personGatewayMock.updateWithFamily).not.toHaveBeenCalled()
  })

  it('should update person fields, relation and phone', async () => {
    await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId,
      name: 'Tatiana',
      lastname: 'Daoudou',
      relationType: 'TUTOR',
      email: 'tatiana@example.com',
      phoneNumber: '0659789006',
    })

    expect(personGatewayMock.updateWithFamily).toHaveBeenCalledWith(
      'school-1',
      familyId,
      personId,
      {
        person: expect.objectContaining({
          name: 'Tatiana',
          lastname: 'Daoudou',
          email: 'tatiana@example.com',
        }),
        relationType: 'TUTOR',
        phoneNumber: '0659789006',
      }
    )
  })

  it('should clear optional fields passed as null', async () => {
    await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId,
      email: null,
      address: null,
      postCode: null,
      city: null,
      phoneNumber: null,
    })

    expect(personGatewayMock.updateWithFamily).toHaveBeenCalledWith(
      'school-1',
      familyId,
      personId,
      {
        person: expect.objectContaining({
          email: null,
          address: null,
          postCode: null,
          city: null,
        }),
        relationType: undefined,
        phoneNumber: null,
      }
    )
  })

  it('should leave omitted fields untouched', async () => {
    await updateFamilyPerson({
      schoolId: 'school-1',
      familyId,
      personId,
      name: 'Tatiana',
    })

    const call = personGatewayMock.updateWithFamily.mock.calls[0][3]
    expect(call.phoneNumber).toBeUndefined()
    expect(call.person.email).toBeUndefined()
  })
})
