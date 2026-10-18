import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  $transaction: vi.fn(),
}

const isPaymentsEnabled = vi.fn(async () => true)
const ensureUnpriced = vi.fn(async () => ({ id: 'plan-unpriced' }))

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: () => isPaymentsEnabled(),
}))
vi.mock('@/gateways/plan-gateway', () => ({ planGateway: { ensureUnpriced } }))

// Import dynamique : le module lit `db` à l'import et doit être chargé après le double.
const { createFullFamily } = await import('./create-full-family')

const schoolId = 'school-1'
const createdById = 'user-1'
const planId = '550e8400-e29b-41d4-a716-446655440002'
const classPeriodId = '550e8400-e29b-41d4-a716-446655440003'
const otherClassPeriodId = '550e8400-e29b-41d4-a716-446655440004'

type Tx = {
  plan: { findFirst: Mock }
  $queryRaw: Mock
  classAssignment: { count: Mock; create: Mock }
  family: { create: Mock }
  person: { create: Mock }
  student: { create: Mock }
  enrollment: { create: Mock }
}

let tx: Tx

const child = (overrides: Record<string, unknown> = {}) => ({
  person: { name: 'Laylah', lastname: 'Dupont' },
  student: {},
  ...overrides,
})

const input = (overrides: Record<string, unknown> = {}) => ({
  schoolId,
  createdById,
  name: 'Dupont',
  parents: [{ name: 'Jean', lastname: 'Dupont', phoneNumber: '0612345678' }],
  ...overrides,
})

describe('createFullFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let personCount = 0
    let studentCount = 0
    let enrollmentCount = 0
    tx = {
      plan: { findFirst: vi.fn().mockResolvedValue({ amount: 180 }) },
      $queryRaw: vi.fn().mockResolvedValue([{ capacity: 20 }]),
      classAssignment: { count: vi.fn().mockResolvedValue(3), create: vi.fn() },
      family: { create: vi.fn().mockResolvedValue({ id: 'family-1' }) },
      person: { create: vi.fn(async () => ({ id: `person-${++personCount}` })) },
      student: { create: vi.fn(async () => ({ id: `student-${++studentCount}` })) },
      enrollment: { create: vi.fn(async () => ({ id: `enrollment-${++enrollmentCount}` })) },
    }
    isPaymentsEnabled.mockResolvedValue(true)
    dbMock.$transaction = vi.fn(async (cb: (client: Tx) => unknown) => cb(tx))
  })

  it('keeps the minimal flow: a family with only a name', async () => {
    const result = await createFullFamily({ schoolId, createdById, name: 'Dupont', parents: [] })

    expect(result).toEqual({ id: 'family-1', studentIds: [], enrollmentIds: [] })
    expect(tx.family.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Dupont', schoolId, createdById }),
      })
    )
    expect(tx.person.create).not.toHaveBeenCalled()
    expect(isPaymentsEnabled).not.toHaveBeenCalled()
  })

  it('creates the guardian with his phone, and children with and without enrollment', async () => {
    const result = await createFullFamily(
      input({
        emergencyContactName: 'Jean Dupont',
        emergencyContactPhone: '0612345678',
        students: [
          child({ enrollment: { planId, classPeriodId } }),
          child({ person: { name: 'Adam', lastname: 'Dupont' } }),
        ],
      })
    )

    expect(result).toEqual({
      id: 'family-1',
      studentIds: ['student-1', 'student-2'],
      enrollmentIds: ['enrollment-1'],
    })
    expect(tx.person.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Jean',
          families: { create: { familyId: 'family-1', relationType: 'PARENT' } },
          phoneNumbers: { create: { phoneNumber: '0612345678', channels: [] } },
        }),
      })
    )
    expect(tx.person.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Laylah',
          families: { create: { familyId: 'family-1', relationType: 'OTHER' } },
        }),
      })
    )
    expect(tx.enrollment.create).toHaveBeenCalledTimes(1)
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          planId,
          totalAmount: 180,
          discount: 0,
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

  it('reserves one seat per child in a shared class, before any write', async () => {
    tx.$queryRaw.mockResolvedValue([{ capacity: 4 }])

    const result = await createFullFamily(
      input({
        students: [
          child({ enrollment: { planId, classPeriodId } }),
          child({ enrollment: { planId, classPeriodId } }),
        ],
      })
    )

    expect(result).toBe('classFull')
    expect(tx.family.create).not.toHaveBeenCalled()
    expect(tx.person.create).not.toHaveBeenCalled()
  })

  it('refuses a vanished plan without leaving an orphan family', async () => {
    tx.plan.findFirst.mockResolvedValue(null)

    const result = await createFullFamily(
      input({ students: [child({ enrollment: { planId, classPeriodId } })] })
    )

    expect(result).toBe('notFound')
    expect(tx.family.create).not.toHaveBeenCalled()
  })

  it('refuses a missing class without leaving an orphan family', async () => {
    tx.$queryRaw.mockResolvedValue([])

    const result = await createFullFamily(
      input({ students: [child({ enrollment: { planId, classPeriodId: otherClassPeriodId } })] })
    )

    expect(result).toBe('notFound')
    expect(tx.family.create).not.toHaveBeenCalled()
  })

  it('refuses an amount due above the plan price before any write', async () => {
    const result = await createFullFamily(
      input({ students: [child({ enrollment: { planId, classPeriodId, totalAmount: 500 } })] })
    )

    expect(result).toBe('totalAmountExceedsPlan')
    expect(tx.family.create).not.toHaveBeenCalled()
  })

  it('requires a plan for an enrollment while payments are enabled', async () => {
    const result = await createFullFamily(
      input({ students: [child({ enrollment: { classPeriodId } })] })
    )

    expect(result).toBe('validationError')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('enrolls on the unpriced plan once when payments are disabled', async () => {
    isPaymentsEnabled.mockResolvedValue(false)

    const result = await createFullFamily(
      input({
        students: [
          child({ enrollment: { classPeriodId } }),
          child({ enrollment: { classPeriodId: otherClassPeriodId } }),
        ],
      })
    )

    expect(result).toEqual(
      expect.objectContaining({ enrollmentIds: ['enrollment-1', 'enrollment-2'] })
    )
    expect(ensureUnpriced).toHaveBeenCalledTimes(1)
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'plan-unpriced', totalAmount: 0, discount: 0 }),
      })
    )
  })

  it('refuses a plan while payments are disabled', async () => {
    isPaymentsEnabled.mockResolvedValue(false)

    const result = await createFullFamily(
      input({ students: [child({ enrollment: { planId, classPeriodId } })] })
    )

    expect(result).toBe('paymentsDisabled')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a birthday in the future', async () => {
    const result = await createFullFamily(
      input({ students: [child({ student: { birthday: new Date('2999-01-01') } })] })
    )

    expect(result).toBe('validationError')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a child without lastname', async () => {
    const result = await createFullFamily(
      input({ students: [child({ person: { name: 'Adam', lastname: '' } })] })
    )

    expect(result).toBe('validationError')
  })

  it('refuses an empty family name', async () => {
    const result = await createFullFamily(input({ name: '  ' }))

    expect(result).toBe('validationError')
  })
})
