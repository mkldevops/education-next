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
  findActiveInPeriod: vi.fn(),
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

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('createEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    studentGatewayMock.findById = vi.fn()
    planGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.countEnrolled = vi.fn()
    enrollmentGatewayMock.findActiveInPeriod = vi.fn()
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
      schoolId,
      studentId: 'invalid-uuid',
      planId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 0,
      canLeaveAlone: false,
    })

    expect(result).toBe('validationError')
  })

  it('should fail with student not found', async () => {
    studentGatewayMock.findById.mockResolvedValue(null)

    const result = await createEnrollment({
      schoolId,
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
      discount: 0,
      canLeaveAlone: false,
    })

    expect(result).toBe('notFound')
  })

  it('should fail with plan not found', async () => {
    studentGatewayMock.findById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' })
    planGatewayMock.findById.mockResolvedValue(null)

    const result = await createEnrollment({
      schoolId,
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
      discount: 0,
      canLeaveAlone: false,
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
      schoolId,
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
      discount: 0,
      canLeaveAlone: false,
    })

    expect(result).toBe('notFound')
  })

  const validInput = {
    schoolId,
    studentId: '550e8400-e29b-41d4-a716-446655440000',
    planId: '550e8400-e29b-41d4-a716-446655440001',
    classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    discount: 0,
    canLeaveAlone: false,
  }

  function mockValidReferences() {
    studentGatewayMock.findById.mockResolvedValue({ id: validInput.studentId })
    planGatewayMock.findById.mockResolvedValue({ id: validInput.planId, amount: 100 })
    classPeriodGatewayMock.findById.mockResolvedValue({
      id: validInput.classPeriodId,
      capacity: 10,
    })
  }

  it('should fail with duplicate enrollment', async () => {
    mockValidReferences()
    enrollmentGatewayMock.findActiveInPeriod.mockResolvedValue({
      id: 'existing',
      status: 'ACTIVE',
      _count: { payments: 0 },
    })

    expect(await createEnrollment(validInput)).toBe('duplicateEnrollment')
  })

  it('cancels the existing enrollment when the caller asks to replace it', async () => {
    mockValidReferences()
    enrollmentGatewayMock.findActiveInPeriod.mockResolvedValue({
      id: 'existing',
      status: 'ACTIVE',
      _count: { payments: 0 },
    })
    const updateMany = vi.fn()
    const update = vi.fn()
    dbMock.$transaction = vi.fn(async (cb) =>
      cb({
        classAssignment: { updateMany, count: vi.fn().mockResolvedValue(0), create: vi.fn() },
        enrollment: { update, create: vi.fn().mockResolvedValue({ id: 'created' }) },
      })
    )

    const result = await createEnrollment({ ...validInput, replaceExisting: true })

    expect(result).toEqual({ id: 'created' })
    expect(updateMany).toHaveBeenCalledWith({
      where: { schoolId, enrollmentId: 'existing', endAt: null },
      data: { endAt: expect.any(Date) },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'existing', schoolId } },
      data: { status: 'CANCELLED' },
    })
  })

  it('refuses to replace an enrollment that already received a payment', async () => {
    mockValidReferences()
    enrollmentGatewayMock.findActiveInPeriod.mockResolvedValue({
      id: 'existing',
      status: 'ACTIVE',
      _count: { payments: 1 },
    })

    expect(await createEnrollment({ ...validInput, replaceExisting: true })).toBe(
      'existingEnrollmentPaid'
    )
  })
})
