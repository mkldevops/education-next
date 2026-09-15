import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findById: vi.fn(),
  update: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

const { updateFamily } = await import('./update-family')

describe('updateFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findById = vi.fn()
    familyGatewayMock.update = vi.fn().mockResolvedValue({})
  })

  it('should fail validation with invalid input', async () => {
    const result = await updateFamily({
      schoolId: 'school-1',
      id: 'invalid-uuid',
      name: 'New Name',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name is empty string', async () => {
    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name exceeds max length', async () => {
    const longName = 'a'.repeat(51)
    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: longName,
    })

    expect(result).toBe('validationError')
  })

  it('should fail with family not found', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Name',
    })

    expect(result).toBe('notFound')
  })

  it('should succeed updating family name', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Old Name',
    })

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Name',
    })

    expect(result).not.toBe('validationError')
  })

  it('should update family with new name', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Old Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Name',
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        name: 'Updated Name',
      })
    )
  })

  it('should update family with emergency contact', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      emergencyContactName: 'Marie Dupont',
      emergencyContactPhone: '+33 6 12 34 56 78',
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        emergencyContactName: 'Marie Dupont',
        emergencyContactPhone: '+33 6 12 34 56 78',
      })
    )
  })

  it('should fail when the emergency contact phone has an invalid format', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      emergencyContactName: 'Marie Dupont',
      emergencyContactPhone: 'Fahari',
    })

    expect(result).toBe('validationError')
  })

  it('should update family with authorized pickup', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      authorizedPickup: 'John Doe',
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        authorizedPickup: 'John Doe',
      })
    )
  })

  it('should update multiple fields at once', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Old Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Name',
      emergencyContactName: 'Contact Info',
      emergencyContactPhone: '0612345678',
      authorizedPickup: 'Jane Doe',
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        name: 'New Name',
        emergencyContactName: 'Contact Info',
        emergencyContactPhone: '0612345678',
        authorizedPickup: 'Jane Doe',
      })
    )
  })

  it('should return updated family', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Old Name',
    })

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Name',
    })

    expect(result).toBeTruthy()
  })

  it('should fail when updating name with only whitespace', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '   ',
    })

    expect(result).toBe('validationError')
  })

  it('should clear the optional fields when they are passed as null', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      emergencyContactName: null,
      emergencyContactPhone: null,
      authorizedPickup: null,
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      {
        name: undefined,
        emergencyContactName: null,
        emergencyContactPhone: null,
        authorizedPickup: null,
        languagesAtHome: undefined,
      }
    )
  })

  it('should leave the optional fields untouched when they are omitted', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Name',
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      {
        name: 'New Name',
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
        authorizedPickup: undefined,
        languagesAtHome: undefined,
      }
    )
  })

  it('should replace the languages spoken at home', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      languagesAtHome: ['Français', 'Arabe'],
    })

    expect(familyGatewayMock.update).toHaveBeenCalledWith(
      'school-1',
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({ languagesAtHome: ['Français', 'Arabe'] })
    )
  })

  it('should allow updating only emergency contact', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Family Name',
    })

    const result = await updateFamily({
      schoolId: 'school-1',
      id: '550e8400-e29b-41d4-a716-446655440000',
      emergencyContactName: 'New Contact',
    })

    expect(result).not.toBe('validationError')
  })
})
