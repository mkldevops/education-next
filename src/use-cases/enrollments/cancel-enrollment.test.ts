import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  updateStatus: vi.fn(),
}
const classAssignmentGatewayMock = {
  closeCurrent: vi.fn(),
}

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/class-assignment-gateway', () => ({
  classAssignmentGateway: classAssignmentGatewayMock,
}))

const { cancelEnrollment } = await import('./cancel-enrollment')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('cancelEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.updateStatus = vi.fn()
    classAssignmentGatewayMock.closeCurrent = vi.fn()
  })

  it('should fail validation with invalid input', async () => {
    const result = await cancelEnrollment({
      schoolId,
      id: 'invalid-uuid',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when transitioning from COMPLETED status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'COMPLETED',
    })

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when transitioning from CANCELLED status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CANCELLED',
    })

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should succeed when transitioning from PENDING status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
      payments: [],
    })

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should succeed when transitioning from ACTIVE status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
      payments: [],
    })

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should refuse cancelling an enrollment with an active payment attached', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
      payments: [{ amount: 50 }],
    })

    const result = await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('enrollmentPaid')
    expect(classAssignmentGatewayMock.closeCurrent).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.updateStatus).not.toHaveBeenCalled()
  })

  it('should close current class assignment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
      payments: [],
    })

    await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(classAssignmentGatewayMock.closeCurrent).toHaveBeenCalledWith(
      schoolId,
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('should update enrollment status to CANCELLED', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
      payments: [],
    })

    await cancelEnrollment({
      schoolId,
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(enrollmentGatewayMock.updateStatus).toHaveBeenCalledWith(
      schoolId,
      '550e8400-e29b-41d4-a716-446655440000',
      'CANCELLED'
    )
  })
})
