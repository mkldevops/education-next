import { beforeEach, describe, expect, it, vi } from 'vitest'

let enrollmentGatewayMock = {
  findById: vi.fn(),
}
let classPeriodGatewayMock = {
  findById: vi.fn(),
  countEnrolled: vi.fn(),
}
let classAssignmentGatewayMock = {
  closeCurrent: vi.fn(),
  create: vi.fn(),
}

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/class-period-gateway', () => ({
  classPeriodGateway: classPeriodGatewayMock,
}))

vi.mock('@/gateways/class-assignment-gateway', () => ({
  classAssignmentGateway: classAssignmentGatewayMock,
}))

const { reassignClass } = await import('./reassign-class')

describe('reassignClass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.countEnrolled = vi.fn()
    classAssignmentGatewayMock.closeCurrent = vi.fn()
    classAssignmentGatewayMock.create = vi.fn()
  })

  it('should fail validation with invalid input', async () => {
    const result = await reassignClass({
      enrollmentId: 'invalid-uuid',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when enrollment status is COMPLETED', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'COMPLETED',
    })

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when enrollment status is CANCELLED', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CANCELLED',
    })

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail with new class period not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    })
    classPeriodGatewayMock.findById.mockResolvedValue(null)

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when new class period is full', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    })
    classPeriodGatewayMock.countEnrolled.mockResolvedValue(10)

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('classFull')
  })

  it('should succeed when reassigning from PENDING status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    })
    classPeriodGatewayMock.countEnrolled.mockResolvedValue(5)

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('OK')
  })

  it('should succeed when reassigning from ACTIVE status', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    })
    classPeriodGatewayMock.countEnrolled.mockResolvedValue(5)

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('OK')
  })

  it('should close current class assignment during reassignment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    })
    classPeriodGatewayMock.countEnrolled.mockResolvedValue(5)

    await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(classAssignmentGatewayMock.closeCurrent).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('should create new class assignment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    })
    classPeriodGatewayMock.countEnrolled.mockResolvedValue(5)

    await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(classAssignmentGatewayMock.create).toHaveBeenCalledWith({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })
  })
})
