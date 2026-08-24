import { beforeEach, describe, expect, it, vi } from 'vitest'

const periodGatewayMock = {
  findById: vi.fn(),
}
const enrollmentGatewayMock = {
  findCompletedByPeriod: vi.fn(),
  findEnrolledStudentIds: vi.fn(),
}
const dbMock = {
  classPeriod: { findMany: vi.fn() },
  classAssignment: { groupBy: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/gateways/period-gateway', () => ({
  periodGateway: periodGatewayMock,
}))

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/lib/db', () => ({
  db: dbMock,
}))

const { promoteStudents, previewPromoteStudents } = await import('./promote-students')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'
const sourcePeriodId = '550e8400-e29b-41d4-a716-446655440000'
const targetPeriodId = '550e8400-e29b-41d4-a716-446655440001'
const targetClassPeriodId = '550e8400-e29b-41d4-a716-446655440002'
const nextLevelId = '550e8400-e29b-41d4-a716-446655440021'
const defaultStudentId = '550e8400-e29b-41d4-a716-446655440011'

function buildEnrollment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440010',
    studentId: defaultStudentId,
    planId: '550e8400-e29b-41d4-a716-446655440012',
    totalAmount: 100,
    discount: 0,
    canLeaveAlone: false,
    classAssignments: [
      {
        classPeriod: {
          level: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            nextLevel: { id: nextLevelId, isActive: true },
          },
        },
      },
    ],
    ...overrides,
  }
}

function mockTransactionSuccess() {
  dbMock.$transaction = vi.fn(async (cb) => {
    const tx = {
      enrollment: {
        create: vi.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440099' }),
      },
      classAssignment: { create: vi.fn() },
    }
    return cb(tx)
  })
}

describe('promoteStudents / previewPromoteStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    periodGatewayMock.findById = vi.fn().mockResolvedValue({ id: sourcePeriodId })
    enrollmentGatewayMock.findCompletedByPeriod = vi.fn().mockResolvedValue([])
    enrollmentGatewayMock.findEnrolledStudentIds = vi.fn().mockImplementation(async () => new Set())
    dbMock.classPeriod.findMany = vi
      .fn()
      .mockResolvedValue([{ id: targetClassPeriodId, levelId: nextLevelId, capacity: 10 }])
    dbMock.classAssignment.groupBy = vi.fn().mockResolvedValue([])
    mockTransactionSuccess()
  })

  describe('promoteStudents', () => {
    it('should fail validation with invalid input', async () => {
      const result = await promoteStudents({
        schoolId,
        sourcePeriodId: 'invalid-uuid',
        targetPeriodId,
      })

      expect(result).toBe('validationError')
    })

    it('should fail when source period not found', async () => {
      periodGatewayMock.findById.mockResolvedValueOnce(null)

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should fail when target period not found', async () => {
      periodGatewayMock.findById
        .mockResolvedValueOnce({ id: sourcePeriodId })
        .mockResolvedValueOnce(null)

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should promote an eligible enrollment', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 1, skipped: 0, errors: [] })
    })

    it('should skip students who already have an enrollment in the target period', async () => {
      enrollmentGatewayMock.findEnrolledStudentIds.mockResolvedValue(new Set([defaultStudentId]))
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
      expect(dbMock.$transaction).not.toHaveBeenCalled()
    })

    it('should promote a student with two source-period enrollments only once', async () => {
      const enrollments = [
        buildEnrollment({ id: 'enrollment-1' }),
        buildEnrollment({ id: 'enrollment-2' }),
      ]
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue(enrollments)

      const preview = await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })
      const execution = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(preview).toMatchObject({
        promoted: 1,
        skipped: 1,
        skippedByReason: expect.objectContaining({ alreadyPromoted: 1 }),
      })
      expect(execution).toEqual({ promoted: 1, skipped: 1, errors: [] })
    })

    it('should skip when there is no class assignment', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ classAssignments: [] }),
      ])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when there is no next level', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({
          classAssignments: [{ classPeriod: { level: { id: 'level-1', nextLevel: null } } }],
        }),
      ])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when the next level is inactive', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({
          classAssignments: [
            {
              classPeriod: {
                level: { id: 'level-1', nextLevel: { id: 'level-2', isActive: false } },
              },
            },
          ],
        }),
      ])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when there is no active target class period', async () => {
      dbMock.classPeriod.findMany.mockResolvedValue([])
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when the target class period is full', async () => {
      dbMock.classPeriod.findMany.mockResolvedValue([
        { id: targetClassPeriodId, levelId: nextLevelId, capacity: 5 },
      ])
      dbMock.classAssignment.groupBy.mockResolvedValue([
        { classPeriodId: targetClassPeriodId, _count: { _all: 5 } },
      ])
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should return a typed error (no raw Prisma message) and release the capacity slot on failure', async () => {
      dbMock.classPeriod.findMany.mockResolvedValue([
        { id: targetClassPeriodId, levelId: nextLevelId, capacity: 1 },
      ])
      let callCount = 0
      dbMock.$transaction = vi.fn(async (cb) => {
        callCount++
        const tx = {
          enrollment: {
            create:
              callCount === 1
                ? vi
                    .fn()
                    .mockRejectedValue(
                      new Error(
                        "Foreign key constraint failed on the field: 'Enrollment_planId_fkey'"
                      )
                    )
                : vi.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440099' }),
          },
          classAssignment: { create: vi.fn() },
        }
        return cb(tx)
      })
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ studentId: 'student-1' }),
        buildEnrollment({ studentId: 'student-2' }),
      ])

      const result = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({
        promoted: 1,
        skipped: 1,
        errors: [{ studentId: 'student-1', reason: 'createFailed' }],
      })
    })

    it('should run one transaction per promoted student, not one for the whole batch', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ studentId: 'student-1' }),
        buildEnrollment({ studentId: 'student-2' }),
      ])

      await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(dbMock.$transaction).toHaveBeenCalledTimes(2)
    })
  })

  describe('previewPromoteStudents', () => {
    it('should fail validation with invalid input', async () => {
      const result = await previewPromoteStudents({
        schoolId,
        sourcePeriodId: 'invalid-uuid',
        targetPeriodId,
      })

      expect(result).toBe('validationError')
    })

    it('should fail when source period not found', async () => {
      periodGatewayMock.findById.mockResolvedValueOnce(null)

      const result = await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should not open a transaction or create any record', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(dbMock.$transaction).not.toHaveBeenCalled()
    })

    it('should count an eligible enrollment as promoted', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({
        promoted: 1,
        skipped: 0,
        skippedByReason: {
          alreadyPromoted: 0,
          noClassAssignment: 0,
          noNextLevel: 0,
          noTargetClass: 0,
          targetClassFull: 0,
        },
      })
    })

    it('should break down skip reasons, including already-promoted students', async () => {
      enrollmentGatewayMock.findEnrolledStudentIds.mockResolvedValue(new Set(['student-3']))
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ studentId: 'student-1', classAssignments: [] }),
        buildEnrollment({
          studentId: 'student-2',
          classAssignments: [{ classPeriod: { level: { id: 'level-1', nextLevel: null } } }],
        }),
        buildEnrollment({ studentId: 'student-3' }),
      ])

      const result = await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(result).toEqual({
        promoted: 0,
        skipped: 3,
        skippedByReason: {
          alreadyPromoted: 1,
          noClassAssignment: 1,
          noNextLevel: 1,
          noTargetClass: 0,
          targetClassFull: 0,
        },
      })
    })

    it('should agree with promoteStudents on totals when the target class is over capacity', async () => {
      dbMock.classPeriod.findMany.mockResolvedValue([
        { id: targetClassPeriodId, levelId: nextLevelId, capacity: 2 },
      ])
      const enrollments = [
        buildEnrollment({ studentId: 'student-1' }),
        buildEnrollment({ studentId: 'student-2' }),
        buildEnrollment({ studentId: 'student-3' }),
      ]
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue(enrollments)

      const preview = await previewPromoteStudents({ schoolId, sourcePeriodId, targetPeriodId })
      const execution = await promoteStudents({ schoolId, sourcePeriodId, targetPeriodId })

      expect(preview).toMatchObject({ promoted: 2, skipped: 1 })
      expect(execution).toMatchObject({ promoted: 2, skipped: 1 })
    })
  })
})
