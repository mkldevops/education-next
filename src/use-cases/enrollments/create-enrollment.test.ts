import { beforeEach, describe, expect, it, vi } from 'vitest'

const studentGatewayMock = {
  findById: vi.fn(),
}
const planGatewayMock = {
  findById: vi.fn(),
  ensureUnpriced: vi.fn(),
}
const isPaymentsEnabledMock = vi.fn()
const classPeriodGatewayMock = {
  findById: vi.fn(),
  countEnrolled: vi.fn(),
}
const enrollmentGatewayMock = {
  lockStudentInPeriod: vi.fn(),
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

vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))

vi.mock('@/lib/db', () => ({
  db: dbMock,
}))

const { createEnrollment } = await import('./create-enrollment')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('createEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planGatewayMock.findById = vi.fn()
    planGatewayMock.ensureUnpriced = vi.fn()
    isPaymentsEnabledMock.mockResolvedValue(true)
    classPeriodGatewayMock.findById = vi.fn()
    classPeriodGatewayMock.countEnrolled = vi.fn()
    enrollmentGatewayMock.lockStudentInPeriod = vi.fn()
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
      periodId: 'period-1',
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

  it('reads the duplicate guard inside the transaction, after locking the student period', async () => {
    mockValidReferences()
    const calls: string[] = []
    let transactionTx: unknown
    dbMock.$transaction = vi.fn(async (cb) => {
      transactionTx = { enrollment: {}, classAssignment: {} }
      return cb(transactionTx)
    })
    enrollmentGatewayMock.lockStudentInPeriod.mockImplementation(async () => {
      calls.push('lock')
    })
    enrollmentGatewayMock.findActiveInPeriod.mockImplementation(async () => {
      calls.push('read')
      return { id: 'existing', status: 'ACTIVE', _count: { payments: 0 } }
    })

    expect(await createEnrollment(validInput)).toBe('duplicateEnrollment')
    expect(calls).toEqual(['lock', 'read'])
    const guardArgs = [transactionTx, schoolId, validInput.studentId, 'period-1']
    expect(enrollmentGatewayMock.lockStudentInPeriod).toHaveBeenCalledWith(...guardArgs)
    expect(enrollmentGatewayMock.findActiveInPeriod).toHaveBeenCalledWith(...guardArgs)
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

  it('rolls back the cancellation when the target class turns out to be full', async () => {
    mockValidReferences()
    enrollmentGatewayMock.findActiveInPeriod.mockResolvedValue({
      id: 'existing',
      status: 'ACTIVE',
      _count: { payments: 0 },
    })
    const update = vi.fn()
    // Une transaction interactive Prisma n'est validée que si le callback résout : `committed`
    // reproduit cette sémantique, qu'un simple `cb(tx)` effacerait.
    let committed = false
    dbMock.$transaction = vi.fn(async (cb) => {
      const result = await cb({
        classAssignment: {
          updateMany: vi.fn(),
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn(),
        },
        enrollment: { update, create: vi.fn() },
      })
      committed = true
      return result
    })

    const result = await createEnrollment({ ...validInput, replaceExisting: true })

    expect(result).toBe('classFull')
    // L'annulation a bien été écrite dans la transaction, mais celle-ci n'a jamais été validée :
    // l'élève garde son inscription au lieu de se retrouver sans aucune.
    expect(update).toHaveBeenCalled()
    expect(committed).toBe(false)
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

  it('requires a planId when payments are enabled, even though the schema allows omitting it', async () => {
    const result = await createEnrollment({
      schoolId,
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
      discount: 0,
      canLeaveAlone: false,
    })

    expect(result).toBe('validationError')
    expect(studentGatewayMock.findById).not.toHaveBeenCalled()
  })

  describe('with payments disabled', () => {
    const disabledInput = {
      schoolId,
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
      canLeaveAlone: false,
    }
    const reservedPlan = {
      id: '550e8400-e29b-41d4-a716-446655440009',
      name: '__unpriced__',
      amount: 0,
    }

    beforeEach(() => {
      isPaymentsEnabledMock.mockResolvedValue(false)
      studentGatewayMock.findById.mockResolvedValue({ id: disabledInput.studentId })
      classPeriodGatewayMock.findById.mockResolvedValue({
        id: disabledInput.classPeriodId,
        capacity: 10,
      })
      planGatewayMock.ensureUnpriced.mockResolvedValue(reservedPlan)
    })

    it('resolves the reserved plan inside the open transaction and writes null amounts', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'created' })
      dbMock.$transaction = vi.fn(async (cb) =>
        cb({
          classAssignment: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
          enrollment: { create },
        })
      )

      const result = await createEnrollment(disabledInput)

      expect(result).toEqual({ id: 'created' })
      expect(planGatewayMock.findById).not.toHaveBeenCalled()
      expect(planGatewayMock.ensureUnpriced).toHaveBeenCalledWith(schoolId, expect.anything())
      expect(create).toHaveBeenCalledWith({
        data: {
          schoolId,
          studentId: disabledInput.studentId,
          planId: reservedPlan.id,
          totalAmount: 0,
          discount: 0,
          canLeaveAlone: false,
        },
      })
    })

    it('refuses with paymentsDisabled when the caller supplies an explicit plan, without writing', async () => {
      const result = await createEnrollment({
        ...disabledInput,
        planId: '550e8400-e29b-41d4-a716-446655440001',
      })

      expect(result).toBe('paymentsDisabled')
      expect(studentGatewayMock.findById).not.toHaveBeenCalled()
      expect(dbMock.$transaction).not.toHaveBeenCalled()
    })

    it('refuses with paymentsDisabled when the caller supplies a non-zero discount, without writing', async () => {
      const result = await createEnrollment({ ...disabledInput, discount: 15 })

      expect(result).toBe('paymentsDisabled')
      expect(studentGatewayMock.findById).not.toHaveBeenCalled()
      expect(dbMock.$transaction).not.toHaveBeenCalled()
    })
  })
})
