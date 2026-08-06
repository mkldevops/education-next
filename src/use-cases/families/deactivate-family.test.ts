import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findById: vi.fn(),
  deactivate: vi.fn(),
  hasActiveEnrollments: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

const { deactivateFamily } = await import('./deactivate-family')

describe('deactivateFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findById = vi.fn()
    familyGatewayMock.deactivate = vi.fn()
    familyGatewayMock.hasActiveEnrollments = vi.fn().mockResolvedValue(false)
  })

  it('should fail validation with invalid input', async () => {
    const result = await deactivateFamily({
      id: 'invalid-uuid',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with family not found', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)

    const result = await deactivateFamily({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('notFound')
  })

  it('should refuse a family that still has pending or active enrollments', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Family',
    })
    familyGatewayMock.hasActiveEnrollments.mockResolvedValue(true)

    const result = await deactivateFamily({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('hasActiveEnrollments')
    expect(familyGatewayMock.deactivate).not.toHaveBeenCalled()
  })

  it('should succeed deactivating existing family', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Family',
    })

    const result = await deactivateFamily({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should deactivate the correct family', async () => {
    familyGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Family',
    })

    await deactivateFamily({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(familyGatewayMock.deactivate).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })
})
