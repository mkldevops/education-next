import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  lockStudentInPeriod: vi.fn(),
}
const classPeriodGatewayMock = {
  findById: vi.fn(),
}

const txMock = {
  $queryRaw: vi.fn(),
  classAssignment: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  enrollment: {
    findFirst: vi.fn(),
  },
}

const dbMock = {
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
}

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/class-period-gateway', () => ({
  classPeriodGateway: classPeriodGatewayMock,
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { reassignClass } = await import('./reassign-class')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'
const enrollmentId = '550e8400-e29b-41d4-a716-446655440000'
const studentId = '550e8400-e29b-41d4-a716-446655440050'
const currentClassId = '550e8400-e29b-41d4-a716-446655440002'
const newClassPeriodId = '550e8400-e29b-41d4-a716-446655440001'
const input = { schoolId, enrollmentId, newClassPeriodId }

function arrangeOpenEnrollment({
  status = 'ACTIVE',
  lockedStatus = status,
  targetPeriodId = 'period-2025',
  currentPeriodId = 'period-2025',
  capacity = 10,
  occupied = 5,
}: {
  status?: string
  lockedStatus?: string | null
  targetPeriodId?: string
  currentPeriodId?: string
  capacity?: number
  occupied?: number
} = {}) {
  enrollmentGatewayMock.findById.mockResolvedValue({ id: enrollmentId, studentId, status })
  classPeriodGatewayMock.findById.mockResolvedValue({
    id: newClassPeriodId,
    periodId: targetPeriodId,
    capacity,
  })
  txMock.$queryRaw
    .mockResolvedValueOnce(lockedStatus ? [{ status: lockedStatus }] : [])
    .mockResolvedValueOnce([{ capacity }])
  txMock.classAssignment.findMany.mockResolvedValue([
    { classPeriodId: currentClassId, endAt: null, classPeriod: { periodId: currentPeriodId } },
  ])
  txMock.classAssignment.count.mockResolvedValue(occupied)
  txMock.enrollment.findFirst.mockResolvedValue(null)
}

describe('reassignClass', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    dbMock.$transaction.mockImplementation(async (callback) => callback(txMock))
  })

  it('should fail validation with invalid input', async () => {
    const result = await reassignClass({ ...input, enrollmentId: 'invalid-uuid' })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    expect(await reassignClass(input)).toBe('notFound')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it.each(['COMPLETED', 'CANCELLED'])('should refuse a %s enrollment', async (status) => {
    enrollmentGatewayMock.findById.mockResolvedValue({ id: enrollmentId, studentId, status })

    expect(await reassignClass(input)).toBe('invalidStatusTransition')
  })

  it('should fail with new class period not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      studentId,
      status: 'ACTIVE',
    })
    classPeriodGatewayMock.findById.mockResolvedValue(null)

    expect(await reassignClass(input)).toBe('notFound')
  })

  it('should re-check the status under the enrollment row lock', async () => {
    arrangeOpenEnrollment({ lockedStatus: 'CANCELLED' })

    expect(await reassignClass(input)).toBe('invalidStatusTransition')
    expect(txMock.classAssignment.create).not.toHaveBeenCalled()
  })

  it('should lock the student in the target period before any read', async () => {
    arrangeOpenEnrollment()

    await reassignClass(input)

    expect(enrollmentGatewayMock.lockStudentInPeriod).toHaveBeenCalledWith(
      txMock,
      schoolId,
      studentId,
      'period-2025'
    )
    const lockOrder = enrollmentGatewayMock.lockStudentInPeriod.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(txMock.$queryRaw.mock.invocationCallOrder[0])
  })

  it('should refuse a class from another period', async () => {
    arrangeOpenEnrollment({ targetPeriodId: 'period-2026', currentPeriodId: 'period-2025' })

    expect(await reassignClass(input)).toBe('periodMismatch')
    expect(txMock.classAssignment.updateMany).not.toHaveBeenCalled()
    expect(txMock.classAssignment.create).not.toHaveBeenCalled()
  })

  it('should refuse when another open enrollment exists in the period', async () => {
    arrangeOpenEnrollment()
    txMock.enrollment.findFirst.mockResolvedValue({ id: 'other-enrollment' })

    expect(await reassignClass(input)).toBe('duplicateEnrollment')
    expect(txMock.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId,
          studentId,
          id: { not: enrollmentId },
          classAssignments: { some: { classPeriod: { periodId: 'period-2025' } } },
        }),
      })
    )
    expect(txMock.classAssignment.create).not.toHaveBeenCalled()
  })

  it('should refuse a full class counted under the class row lock', async () => {
    arrangeOpenEnrollment({ capacity: 10, occupied: 10 })

    expect(await reassignClass(input)).toBe('classFull')
    expect(txMock.classAssignment.updateMany).not.toHaveBeenCalled()
    expect(txMock.classAssignment.create).not.toHaveBeenCalled()
  })

  it('should be a no-op when the student is already in the target class', async () => {
    arrangeOpenEnrollment()
    txMock.classAssignment.findMany.mockResolvedValue([
      { classPeriodId: newClassPeriodId, endAt: null, classPeriod: { periodId: 'period-2025' } },
    ])

    expect(await reassignClass(input)).toBe('OK')
    expect(txMock.classAssignment.updateMany).not.toHaveBeenCalled()
    expect(txMock.classAssignment.create).not.toHaveBeenCalled()
  })

  it.each(['PENDING', 'ACTIVE'])('should reassign a %s enrollment atomically', async (status) => {
    arrangeOpenEnrollment({ status })

    expect(await reassignClass(input)).toBe('OK')
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.classAssignment.updateMany).toHaveBeenCalledWith({
      where: { schoolId, enrollmentId, endAt: null },
      data: { endAt: expect.any(Date) },
    })
    expect(txMock.classAssignment.create).toHaveBeenCalledWith({
      data: { schoolId, enrollmentId, classPeriodId: newClassPeriodId, startAt: expect.any(Date) },
    })
  })
})
