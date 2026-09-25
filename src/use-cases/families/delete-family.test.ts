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
    familyGatewayMock.deleteWithRelated.mockResolvedValue(true)
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

  it('should turn a leftover foreign key refusal into a typed discriminant', async () => {
    familyGatewayMock.deleteWithRelated.mockRejectedValue(
      Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003' })
    )

    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: 'Dupont' })

    expect(result).toBe('deletionBlocked')
  })

  it('should turn an aborted transaction into a typed discriminant', async () => {
    familyGatewayMock.deleteWithRelated.mockRejectedValue(
      Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), {
        code: 'P2034',
      })
    )

    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: 'Dupont' })

    expect(result).toBe('deletionConflict')
  })

  it('should report a family deleted concurrently as not found', async () => {
    familyGatewayMock.deleteWithRelated.mockResolvedValue(false)

    const result = await deleteFamily({ schoolId: 'school-1', id, confirmation: 'Dupont' })

    expect(result).toBe('notFound')
  })

  it('should rethrow an unexpected error rather than disguise it', async () => {
    familyGatewayMock.deleteWithRelated.mockRejectedValue(new Error('connection lost'))

    await expect(
      deleteFamily({ schoolId: 'school-1', id, confirmation: 'Dupont' })
    ).rejects.toThrow('connection lost')
  })
})
