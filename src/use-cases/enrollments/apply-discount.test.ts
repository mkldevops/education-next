import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  updateDiscount: vi.fn(),
}

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

const { applyDiscount } = await import('./apply-discount')

describe('applyDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.updateDiscount = vi.fn()
  })

  it('should fail validation with invalid input', async () => {
    const result = await applyDiscount({
      enrollmentId: 'invalid-uuid',
      discount: 10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with negative discount', async () => {
    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: -10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(result).toBe('notFound')
  })

  it('should reject a discount above the plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100.01,
    })

    expect(result).toBe('discountExceedsPlan')
    expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
  })

  it('should accept a discount equal to the plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      100,
      0
    )
  })

  it('should succeed when applying discount to existing enrollment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(result).toBe('OK')
  })

  it('should update enrollment with correct discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      10,
      90
    )
  })

  it('should calculate correct total amount after discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 25,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      25,
      75
    )
  })

  it('should handle zero discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 0,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      0,
      100
    )
  })

  it('should handle discount equal to plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      100,
      0
    )
  })
})
