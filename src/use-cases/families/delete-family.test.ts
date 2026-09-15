import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findByIdIncludingArchived: vi.fn(),
  deleteWithRelated: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
const { deleteFamily } = await import('./delete-family')

const id = '550e8400-e29b-41d4-a716-446655440000'

describe('deleteFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findByIdIncludingArchived.mockResolvedValue({ id, name: 'Dupont' })
  })

  it('should fail validation with invalid input', async () => {
    const result = await deleteFamily({
      schoolId: 'school-1',
      id: 'invalid-uuid',
      confirmation: 'Dupont',
    })

    expect(result).toBe('validationError')
    expect(familyGatewayMock.deleteWithRelated).not.toHaveBeenCalled()
  })

  it('should fail with family not found', async () => {
    familyGatewayMock.findByIdIncludingArchived.mockResolvedValue(null)

    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: 'Dupont' })

    expect(result).toBe('notFound')
    expect(familyGatewayMock.deleteWithRelated).not.toHaveBeenCalled()
  })

  it('should refuse a confirmation that names another family', async () => {
    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: 'Durand' })

    expect(result).toBe('confirmationMismatch')
    expect(familyGatewayMock.deleteWithRelated).not.toHaveBeenCalled()
  })

  it('should accept a confirmation differing only by case and spacing', async () => {
    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: '  dupont ' })

    expect(result).toBe('OK')
    expect(familyGatewayMock.deleteWithRelated).toHaveBeenCalledWith('school-1', id)
  })
})
