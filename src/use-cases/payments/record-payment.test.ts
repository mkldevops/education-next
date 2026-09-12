import { beforeEach, describe, expect, it, vi } from 'vitest'

const familyGatewayMock = {
  findById: vi.fn(),
}
const enrollmentGatewayMock = {
  findPayableByFamily: vi.fn(),
}
const paymentGatewayMock = {
  createInTransaction: vi.fn(),
}

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: paymentGatewayMock,
}))

const { recordPayment } = await import('./record-payment')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familyGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.findPayableByFamily = vi.fn()
    paymentGatewayMock.createInTransaction = vi.fn()
  })

  it('should fail validation with invalid input', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: 'invalid-uuid',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with zero amount', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 0,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with a cash date on a non-check payment', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'TRANSFER',
      paidAt: new Date(),
      cashedAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('should fail with family not found', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('notFound')
  })

  it('should fail when no active enrollments found', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('noPayableEnrollments')
  })

  it('should fail when payment exceeds total balance', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 150,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('overpayment')
  })

  it('should succeed recording payment with valid data', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 50,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('OK')
  })

  it('should record payment with correct payment method', async () => {
    const paidAt = new Date()
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 50,
      method: 'CARD',
      paidAt,
    })

    expect(paymentGatewayMock.createInTransaction).toHaveBeenCalledWith(
      schoolId,
      expect.arrayContaining([
        expect.objectContaining({
          method: 'CARD',
        }),
      ])
    )
  })

  it('should not subtract an enrollment discount twice', async () => {
    familyGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 80,
        discount: 20,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('OK')
    expect(paymentGatewayMock.createInTransaction).toHaveBeenCalledWith(schoolId, [
      expect.objectContaining({ amount: 80 }),
    ])
  })
})
