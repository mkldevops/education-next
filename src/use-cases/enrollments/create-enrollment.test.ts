import { beforeEach, describe, expect, it, vi } from 'vitest'

const studentGatewayMock = {
  findById: vi.fn(),
}
const planGatewayMock = {
  findById: vi.fn(),
}
const classPeriodGatewayMock = {
  findById: vi.fn(),
  countEnrolled: vi.fn(),
}
const enrollmentGatewayMock = {
  findDuplicate: vi.fn(),
}
const dbMock = {
  $transaction: vi.fn(),
}

vi.mock('@/gateways/student-gateway', () => ({
  studentGateway: studentGatewayMock,
}))

vi.mock('@/gateways/plan-gateway', () => ({
  planGateway: planGatewayMock,
}))

vi.mock('@/gateways/class-period-gateway', () => ({
  classPeriodGateway: classPeriodGatewayMock,
}))

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/lib/db', () => ({
  db: dbMock,
}))

const { createEnrollment } = await import('./create-enrollment')

describe('createEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    studentGatewayMock.findById = vi.fn()
    planGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.countEnrolled = vi.fn()
    enrollmentGatewayMock.findDuplicate = vi.fn()
    dbMock.$transaction = vi.fn(async (cb) => {
      const tx = {
        classAssignment: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
        enrollment: {
          create: vi.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440003' }),
        },
      }
      return cb(tx)
    })
  })

  it('should fail validation with invalid input', async () => {
    const result = await createEnrollment({
      studentId: 'invalid-uuid',
      planId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with student not found', async () => {
    studentGatewayMock.findById.mockResolvedValue(null)

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with plan not found', async () => {
    studentGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    planGatewayMock.findById.mockResolvedValue(null)

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with class period not found', async () => {
    studentGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    planGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      amount: 100,
    })
    classPeriodGatewayMock.findById.mockResolvedValue(null)

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with duplicate enrollment', async () => {
    studentGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    planGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      amount: 100,
    })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440002',
      capacity: 10,
    })
    enrollmentGatewayMock.findDuplicate.mockResolvedValue(true)

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('duplicateEnrollment')
  })
})
