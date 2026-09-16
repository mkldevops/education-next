import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  school: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  config: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `config-gateway.test.ts`.
const { schoolGateway } = await import('../school-gateway')

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.school.findMany.mockResolvedValue([])
})

describe('schoolGateway reads', () => {
  it('never resolves a deactivated school as an active context', async () => {
    await schoolGateway.findActiveById('school-1')

    expect(dbMock.school.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'school-1', isActive: true } })
    )
  })

  it('departages an identical createdAt so the context fallback stays deterministic', async () => {
    await schoolGateway.listActive()

    const [args] = dbMock.school.findMany.mock.calls[0]
    expect(args.where).toEqual({ isActive: true })
    expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
  })

  it('lists deactivated schools for administration, otherwise reactivation is unreachable', async () => {
    await schoolGateway.listAll()

    const [args] = dbMock.school.findMany.mock.calls[0]
    expect(args.where).toBeUndefined()
    expect(args.select.isActive).toBe(true)
  })

  it('reaches a deactivated school by id, for the same reason', async () => {
    await schoolGateway.findById('school-1')

    expect(dbMock.school.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'school-1' } })
    )
  })
})

type Tx = {
  $queryRaw: ReturnType<typeof vi.fn>
  enrollment: { count: ReturnType<typeof vi.fn> }
  paymentTransaction: { count: ReturnType<typeof vi.fn> }
  invitation: { count: ReturnType<typeof vi.fn> }
  school: { update: ReturnType<typeof vi.fn> }
}

function withTransaction(activeIds: string[], counts = [0, 0, 0]) {
  const tx: Tx = {
    $queryRaw: vi.fn().mockResolvedValue(activeIds.map((id) => ({ id }))),
    enrollment: { count: vi.fn().mockResolvedValue(counts[0]) },
    paymentTransaction: { count: vi.fn().mockResolvedValue(counts[1]) },
    invitation: { count: vi.fn().mockResolvedValue(counts[2]) },
    school: { update: vi.fn() },
  }
  dbMock.$transaction.mockImplementation((fn: (client: Tx) => unknown) => fn(tx))
  return tx
}

describe('schoolGateway.deactivate', () => {
  it('locks the active schools before deciding', async () => {
    const tx = withTransaction(['school-1', 'school-2'])

    await schoolGateway.deactivate('school-1')

    expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE')
  })

  it('refuses the last active school and leaves it active', async () => {
    const tx = withTransaction(['school-1'])

    const result = await schoolGateway.deactivate('school-1')

    expect(result).toEqual({ status: 'lastActiveSchool' })
    expect(tx.school.update).not.toHaveBeenCalled()
  })

  it('enumerates the blockers instead of deactivating', async () => {
    const tx = withTransaction(['school-1', 'school-2'], [3, 1, 2])

    const result = await schoolGateway.deactivate('school-1')

    expect(result).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 3, pendingTransactions: 1, pendingInvitations: 2 },
    })
    expect(tx.school.update).not.toHaveBeenCalled()
  })

  it('counts only the enrollments and transactions that still hold the school', async () => {
    const tx = withTransaction(['school-1', 'school-2'])

    await schoolGateway.deactivate('school-1')

    expect(tx.enrollment.count).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', status: { in: ['PENDING', 'ACTIVE'] } },
    })
    expect(tx.paymentTransaction.count).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', status: 'PENDING' },
    })
    expect(tx.invitation.count).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', usedAt: null },
    })
  })

  it('reports a concurrent deactivation that landed first', async () => {
    const tx = withTransaction(['school-2', 'school-3'])

    const result = await schoolGateway.deactivate('school-1')

    expect(result).toEqual({ status: 'alreadyInactive' })
    expect(tx.school.update).not.toHaveBeenCalled()
  })

  it('deactivates when no invariant holds the school', async () => {
    const tx = withTransaction(['school-1', 'school-2'])

    const result = await schoolGateway.deactivate('school-1')

    expect(result).toEqual({ status: 'OK' })
    expect(tx.school.update).toHaveBeenCalledWith({
      where: { id: 'school-1' },
      data: { isActive: false },
    })
  })
})

describe('schoolGateway.create', () => {
  it('creates the default settings with the school, in the same transaction', async () => {
    const tx = {
      school: { create: vi.fn().mockResolvedValue({ id: 'school-1' }) },
      config: { createMany: vi.fn() },
    }
    dbMock.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))

    const school = await schoolGateway.create({ name: 'Chioni', slug: 'chioni' })

    expect(school).toEqual({ id: 'school-1' })
    const [args] = tx.config.createMany.mock.calls[0]
    expect(args.data.map((config: { name: string }) => config.name)).toEqual([
      'logo_url',
      'teacher_expenses_enabled',
      'events_enabled',
      'class_schedule_enabled',
      'class_schedule_teacher_overlap_allowed',
      'class_schedule_visibility',
      'payments_enabled',
      'max_students_per_class',
      'theme_primary',
    ])
    // Une école neuve encaisse comme toutes les autres : le drapeau naît à `true`, et
    // aucune migration ne vient poser `false` sur une école existante.
    expect(args.data).toContainEqual(
      expect.objectContaining({ name: 'payments_enabled', value: 'true' })
    )
    expect(args.data.every((config: { schoolId: string }) => config.schoolId === 'school-1')).toBe(
      true
    )
  })
})
