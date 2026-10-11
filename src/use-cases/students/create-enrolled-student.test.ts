import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  $transaction: vi.fn(),
}

const isPaymentsEnabled = vi.fn(async () => true)
const ensureUnpriced = vi.fn(async () => ({ id: 'plan-unpriced' }))

vi.mock('@/lib/db', () => ({
  db: dbMock,
}))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: () => isPaymentsEnabled(),
}))
vi.mock('@/gateways/plan-gateway', () => ({
  planGateway: { ensureUnpriced },
}))

// Import dynamique volontaire, comme `create-enrollment.test.ts` : le module lit `db` à
// l'import et doit donc être chargé après l'enregistrement du double.
const { createEnrolledStudent } = await import('./create-enrolled-student')

const schoolId = 'school-1'
const familyId = '550e8400-e29b-41d4-a716-446655440001'
const planId = '550e8400-e29b-41d4-a716-446655440002'
const classPeriodId = '550e8400-e29b-41d4-a716-446655440003'

type Tx = {
  family: { findFirst: Mock }
  plan: { findFirst: Mock }
  $queryRaw: Mock
  classAssignment: { count: Mock; create: Mock }
  person: { create: Mock }
  student: { create: Mock }
  enrollment: { create: Mock }
}

let tx: Tx

const input = (overrides: Record<string, unknown> = {}) => ({
  schoolId,
  familyId,
  person: { name: 'Laylah', lastname: 'Hamada Sidi', sex: 'FEMALE' as const },
  student: { birthday: new Date('2018-04-02'), snackAuthorization: false },
  enrollment: { planId, classPeriodId },
  ...overrides,
})

describe('createEnrolledStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx = {
      family: { findFirst: vi.fn().mockResolvedValue({ id: familyId }) },
      plan: { findFirst: vi.fn().mockResolvedValue({ amount: 180 }) },
      $queryRaw: vi.fn().mockResolvedValue([{ capacity: 20 }]),
      classAssignment: { count: vi.fn().mockResolvedValue(3), create: vi.fn() },
      person: { create: vi.fn().mockResolvedValue({ id: 'person-1' }) },
      student: { create: vi.fn().mockResolvedValue({ id: 'student-1' }) },
      enrollment: { create: vi.fn().mockResolvedValue({ id: 'enrollment-1' }) },
    }
    isPaymentsEnabled.mockResolvedValue(true)
    dbMock.$transaction = vi.fn(async (cb: (client: Tx) => unknown) => cb(tx))
  })

  it('creates the person, the student, the enrollment and the class assignment', async () => {
    // WHEN
    const result = await createEnrolledStudent(input({ enrollment: { planId, classPeriodId } }))

    // THEN
    expect(result).toEqual({ studentId: 'student-1', enrollmentId: 'enrollment-1' })
    expect(tx.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Laylah',
          schoolId,
          families: { create: { familyId, relationType: 'OTHER' } },
        }),
      })
    )
    expect(tx.student.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: 'person-1', schoolId }) })
    )
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          planId,
          totalAmount: 180,
          status: 'ACTIVE',
        }),
      })
    )
    expect(tx.classAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enrollmentId: 'enrollment-1', classPeriodId }),
      })
    )
  })

  it('scopes every lookup to the caller school', async () => {
    // WHEN
    await createEnrolledStudent(input())

    // THEN
    expect(tx.family.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: familyId, schoolId, isActive: true } })
    )
    expect(tx.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: planId, schoolId, isActive: true } })
    )
    // Ligne de la classe verrouillée, bornée à l'école et aux classes actives.
    const [sql, ...values] = tx.$queryRaw.mock.calls[0]
    expect(sql.join('?')).toMatch(/"isActive" = true\s+FOR UPDATE/)
    expect(values).toEqual([classPeriodId, schoolId])
  })

  it('counts the occupied seats of the school with the same predicate as createEnrollment', async () => {
    // WHEN
    await createEnrolledStudent(input())

    // THEN
    expect(tx.classAssignment.count).toHaveBeenCalledWith({
      where: {
        schoolId,
        classPeriodId,
        endAt: null,
        enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
      },
    })
  })

  it('accepts a discount equal to the plan amount and bills nothing', async () => {
    // WHEN
    const result = await createEnrolledStudent(
      input({ enrollment: { planId, classPeriodId, discount: 180 } })
    )

    // THEN
    expect(result).toEqual({ studentId: 'student-1', enrollmentId: 'enrollment-1' })
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 0, discount: 180 }) })
    )
  })

  it('carries the leave-alone authorization onto the enrollment', async () => {
    // WHEN
    await createEnrolledStudent(
      input({ enrollment: { planId, classPeriodId, canLeaveAlone: true } })
    )

    // THEN
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ canLeaveAlone: true }) })
    )
  })

  it('subtracts the discount from the plan amount', async () => {
    // WHEN
    await createEnrolledStudent(input({ enrollment: { planId, classPeriodId, discount: 30 } }))

    // THEN
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 150, discount: 30 }),
      })
    )
  })

  it('rejects a discount larger than the plan', async () => {
    // WHEN
    const result = await createEnrolledStudent(
      input({ enrollment: { planId, classPeriodId, discount: 200 } })
    )

    // THEN
    expect(result).toBe('discountExceedsPlan')
    expect(tx.person.create).not.toHaveBeenCalled()
  })

  it('refuses a full class before writing anything', async () => {
    // GIVEN
    tx.$queryRaw.mockResolvedValue([{ capacity: 3 }])

    // WHEN
    const result = await createEnrolledStudent(input())

    // THEN
    expect(result).toBe('classFull')
    expect(tx.person.create).not.toHaveBeenCalled()
    expect(tx.enrollment.create).not.toHaveBeenCalled()
  })

  it.each([
    ['family', 'family'],
    ['plan', 'plan'],
  ] as const)('returns notFound when the %s is missing', async (_label, model) => {
    // GIVEN
    tx[model].findFirst.mockResolvedValue(null)

    // WHEN
    const result = await createEnrolledStudent(input())

    // THEN
    expect(result).toBe('notFound')
    expect(tx.person.create).not.toHaveBeenCalled()
  })

  it('returns notFound when the class is missing or archived', async () => {
    // GIVEN
    tx.$queryRaw.mockResolvedValue([])

    // WHEN
    const result = await createEnrolledStudent(input())

    // THEN
    expect(result).toBe('notFound')
    expect(tx.person.create).not.toHaveBeenCalled()
  })

  it('refuses a birthday in the future without opening a transaction', async () => {
    // WHEN
    const result = await createEnrolledStudent(
      input({
        student: { birthday: new Date(Date.now() + 86_400_000), snackAuthorization: false },
      })
    )

    // THEN
    expect(result).toBe('validationError')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('fails validation when the class is not a uuid', async () => {
    // WHEN
    const result = await createEnrolledStudent(
      input({ enrollment: { planId, classPeriodId: 'not-a-uuid' } })
    )

    // THEN
    expect(result).toBe('validationError')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  // Le dialogue « Ajouter un élève » de la fiche famille passe par ici. Sans ce refus, une
  // école qui a coupé les paiements créait une inscription tarifée qu'aucun écran ne montre
  // et qu'aucun geste ne peut solder.
  it('refuses an explicit plan while payments are off', async () => {
    isPaymentsEnabled.mockResolvedValue(false)

    const result = await createEnrolledStudent(input({ enrollment: { planId, classPeriodId } }))

    expect(result).toBe('paymentsDisabled')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a non-zero discount while payments are off', async () => {
    isPaymentsEnabled.mockResolvedValue(false)

    const result = await createEnrolledStudent(
      input({ enrollment: { classPeriodId, discount: 50 } })
    )

    expect(result).toBe('paymentsDisabled')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('enrolls on the reserved plan at zero while payments are off', async () => {
    isPaymentsEnabled.mockResolvedValue(false)

    const result = await createEnrolledStudent(input({ enrollment: { classPeriodId } }))

    expect(result).toEqual({ studentId: 'student-1', enrollmentId: 'enrollment-1' })
    expect(tx.plan.findFirst).not.toHaveBeenCalled()
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'plan-unpriced', totalAmount: 0, discount: 0 }),
      })
    )
  })

  it('requires a plan while payments are on', async () => {
    const result = await createEnrolledStudent(input({ enrollment: { classPeriodId } }))

    expect(result).toBe('validationError')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })
})
