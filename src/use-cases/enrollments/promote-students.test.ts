import { beforeEach, describe, expect, it, vi } from 'vitest'

const periodGatewayMock = {
  findById: vi.fn(),
}
const enrollmentGatewayMock = {
  findCompletedByPeriod: vi.fn(),
}
const dbMock = {
  classPeriod: { findFirst: vi.fn() },
  classAssignment: { count: vi.fn() },
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

const sourcePeriodId = '550e8400-e29b-41d4-a716-446655440000'
const targetPeriodId = '550e8400-e29b-41d4-a716-446655440001'
const targetClassPeriodId = '550e8400-e29b-41d4-a716-446655440002'

function buildEnrollment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440010',
    studentId: '550e8400-e29b-41d4-a716-446655440011',
    planId: '550e8400-e29b-41d4-a716-446655440012',
    totalAmount: 100,
    discount: 0,
    canLeaveAlone: false,
    classAssignments: [
      {
        classPeriod: {
          level: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            nextLevel: { id: '550e8400-e29b-41d4-a716-446655440021', isActive: true },
          },
        },
      },
    ],
    ...overrides,
  }
}

describe('promoteStudents / previewPromoteStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    periodGatewayMock.findById = vi.fn().mockResolvedValue({ id: sourcePeriodId })
    enrollmentGatewayMock.findCompletedByPeriod = vi.fn().mockResolvedValue([])
    dbMock.classPeriod.findFirst = vi
      .fn()
      .mockResolvedValue({ id: targetClassPeriodId, capacity: 10 })
    dbMock.classAssignment.count = vi.fn().mockResolvedValue(0)
    dbMock.$transaction = vi.fn(async (cb) => {
      const tx = {
        classPeriod: { findFirst: dbMock.classPeriod.findFirst },
        classAssignment: { count: dbMock.classAssignment.count, create: vi.fn() },
        enrollment: {
          create: vi.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440099' }),
        },
      }
      return cb(tx)
    })
  })

  describe('promoteStudents', () => {
    it('should fail validation with invalid input', async () => {
      const result = await promoteStudents({
        sourcePeriodId: 'invalid-uuid',
        targetPeriodId,
      })

      expect(result).toBe('validationError')
    })

    it('should fail when source period not found', async () => {
      periodGatewayMock.findById.mockResolvedValueOnce(null)

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should fail when target period not found', async () => {
      periodGatewayMock.findById
        .mockResolvedValueOnce({ id: sourcePeriodId })
        .mockResolvedValueOnce(null)

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should promote an eligible enrollment', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 1, skipped: 0, errors: [] })
    })

    it('should skip when there is no class assignment', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ classAssignments: [] }),
      ])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when there is no next level', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({
          classAssignments: [{ classPeriod: { level: { id: 'level-1', nextLevel: null } } }],
        }),
      ])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

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

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when there is no active target class period', async () => {
      dbMock.classPeriod.findFirst.mockResolvedValue(null)
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should skip when the target class period is full', async () => {
      dbMock.classPeriod.findFirst.mockResolvedValue({ id: targetClassPeriodId, capacity: 5 })
      dbMock.classAssignment.count.mockResolvedValue(5)
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({ promoted: 0, skipped: 1, errors: [] })
    })

    it('should record an error and count as skipped when enrollment creation fails', async () => {
      dbMock.$transaction = vi.fn(async (cb) => {
        const tx = {
          classPeriod: { findFirst: dbMock.classPeriod.findFirst },
          classAssignment: { count: dbMock.classAssignment.count, create: vi.fn() },
          enrollment: {
            create: vi.fn().mockRejectedValue(new Error('boom')),
          },
        }
        return cb(tx)
      })
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toMatchObject({ promoted: 0, skipped: 1 })
      expect((result as { errors: string[] }).errors).toHaveLength(1)
      expect((result as { errors: string[] }).errors[0]).toContain('boom')
    })
  })

  describe('previewPromoteStudents', () => {
    it('should fail validation with invalid input', async () => {
      const result = await previewPromoteStudents({
        sourcePeriodId: 'invalid-uuid',
        targetPeriodId,
      })

      expect(result).toBe('validationError')
    })

    it('should fail when source period not found', async () => {
      periodGatewayMock.findById.mockResolvedValueOnce(null)

      const result = await previewPromoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toBe('notFound')
    })

    it('should not open a transaction or create any record', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      await previewPromoteStudents({ sourcePeriodId, targetPeriodId })

      expect(dbMock.$transaction).not.toHaveBeenCalled()
    })

    it('should count an eligible enrollment as promoted', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([buildEnrollment()])

      const result = await previewPromoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({
        promoted: 1,
        skipped: 0,
        skippedByReason: {
          noClassAssignment: 0,
          noNextLevel: 0,
          noTargetClass: 0,
          targetClassFull: 0,
        },
      })
    })

    it('should break down skip reasons', async () => {
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue([
        buildEnrollment({ classAssignments: [] }),
        buildEnrollment({
          classAssignments: [{ classPeriod: { level: { id: 'level-1', nextLevel: null } } }],
        }),
      ])

      const result = await previewPromoteStudents({ sourcePeriodId, targetPeriodId })

      expect(result).toEqual({
        promoted: 0,
        skipped: 2,
        skippedByReason: {
          noClassAssignment: 1,
          noNextLevel: 1,
          noTargetClass: 0,
          targetClassFull: 0,
        },
      })
    })

    it('should agree with promoteStudents on totals for the same fixtures', async () => {
      const enrollments = [
        buildEnrollment(),
        buildEnrollment({ id: 'enrollment-2', classAssignments: [] }),
      ]
      enrollmentGatewayMock.findCompletedByPeriod.mockResolvedValue(enrollments)

      const preview = await previewPromoteStudents({ sourcePeriodId, targetPeriodId })
      const execution = await promoteStudents({ sourcePeriodId, targetPeriodId })

      expect(preview).toMatchObject({ promoted: 1, skipped: 1 })
      expect(execution).toMatchObject({ promoted: 1, skipped: 1 })
    })
  })
})
