import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  updateDiscount: vi.fn(),
}
const configGatewayMock = {
  get: vi.fn(),
}

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/config-gateway', () => ({
  configGateway: configGatewayMock,
}))

const { applyDiscount } = await import('./apply-discount')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('applyDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.updateDiscount = vi.fn()
    configGatewayMock.get = vi.fn().mockResolvedValue({ value: 'true' })
  })

  it('should fail validation with invalid input', async () => {
    const result = await applyDiscount({
      schoolId,
      enrollmentId: 'invalid-uuid',
      discount: 10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with negative discount', async () => {
    const result = await applyDiscount({
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: -10,
    })

    expect(result).toBe('validationError')
  })

  it('should refuse to apply a discount when payments are disabled', async () => {
    configGatewayMock.get.mockResolvedValue({ value: 'false' })

    const result = await applyDiscount({
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(result).toBe('paymentsDisabled')
    expect(enrollmentGatewayMock.findById).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await applyDiscount({
      schoolId,
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
      schoolId,
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
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
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
      schoolId,
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
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
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
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 25,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
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
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 0,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      '550e8400-e29b-41d4-a716-446655440000',
      0,
      100
    )
  })

  it('derives a 60 euro discount from a final amount of 240 euros', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
      payments: [],
      plan: { amount: 300 },
    })

    expect(
      await applyDiscount({
        schoolId,
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        totalAmount: 240,
      })
    ).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      '550e8400-e29b-41d4-a716-446655440000',
      60,
      240
    )
  })

  it('refuses a final amount lower than recorded payments', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
      payments: [{ amount: 250 }],
      plan: { amount: 300 },
    })

    expect(
      await applyDiscount({
        schoolId,
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        totalAmount: 240,
      })
    ).toBe('totalBelowPaid')
  })

  it('refuses a final amount with more than two decimal places', async () => {
    expect(
      await applyDiscount({
        schoolId,
        enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
        totalAmount: 240.001,
      })
    ).toBe('validationError')
    expect(enrollmentGatewayMock.findById).not.toHaveBeenCalled()
  })

  it('should handle discount equal to plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      '550e8400-e29b-41d4-a716-446655440000',
      100,
      0
    )
  })
})
