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

describe('cancelEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.updateStatus = vi.fn()
    classAssignmentGatewayMock.closeCurrent = vi.fn()
  })

  it('should fail validation with invalid input', async () => {
    const result = await cancelEnrollment({
      id: 'invalid-uuid',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await cancelEnrollment({
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
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should succeed when transitioning from PENDING status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    })

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should succeed when transitioning from ACTIVE status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should close current class assignment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })

    await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(classAssignmentGatewayMock.closeCurrent).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('should update enrollment status to CANCELLED', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })

    await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(enrollmentGatewayMock.updateStatus).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'CANCELLED'
    )
  })
})
