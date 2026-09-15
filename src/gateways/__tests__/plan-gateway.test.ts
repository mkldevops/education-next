import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  plan: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy. Même
// motif que `class-period-gateway.test.ts` et `school-gateway.test.ts`.
const { planGateway } = await import('../plan-gateway')

const SCHOOL = 'school-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('planGateway.ensureUnpriced', () => {
  it('creates the reserved plan once, then reuses the existing row on later calls', async () => {
    const created = { id: 'plan-reserved', schoolId: SCHOOL, name: '__unpriced__', amount: 0 }
    dbMock.plan.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(created)
    dbMock.plan.create.mockResolvedValue(created)

    const first = await planGateway.ensureUnpriced(SCHOOL)
    const second = await planGateway.ensureUnpriced(SCHOOL)

    expect(first).toBe(created)
    expect(second).toBe(created)
    // Trouvé-ou-créé : la ligne n'est posée qu'une fois, la deuxième demande la retrouve.
    expect(dbMock.plan.create).toHaveBeenCalledTimes(1)
    expect(dbMock.plan.create).toHaveBeenCalledWith({
      data: { schoolId: SCHOOL, name: '__unpriced__', amount: 0 },
    })
  })

  it('never creates when a reserved row already exists', async () => {
    const existing = { id: 'plan-reserved', schoolId: SCHOOL, name: '__unpriced__', amount: 0 }
    dbMock.plan.findFirst.mockResolvedValue(existing)

    const result = await planGateway.ensureUnpriced(SCHOOL)

    expect(result).toBe(existing)
    expect(dbMock.plan.create).not.toHaveBeenCalled()
  })

  it('scopes the lookup to the school and the reserved technical name', async () => {
    dbMock.plan.findFirst.mockResolvedValue({ id: 'plan-reserved' })

    await planGateway.ensureUnpriced(SCHOOL)

    expect(dbMock.plan.findFirst).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, name: '__unpriced__' },
    })
  })

  it('runs against the transaction client it is given, not the top-level db', async () => {
    const txPlan = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() }
    const created = { id: 'plan-reserved', schoolId: SCHOOL, name: '__unpriced__', amount: 0 }
    txPlan.create.mockResolvedValue(created)
    const tx = { plan: txPlan } as unknown as Parameters<typeof planGateway.ensureUnpriced>[1]

    const result = await planGateway.ensureUnpriced(SCHOOL, tx)

    expect(result).toBe(created)
    expect(txPlan.create).toHaveBeenCalledTimes(1)
    expect(dbMock.plan.findFirst).not.toHaveBeenCalled()
    expect(dbMock.plan.create).not.toHaveBeenCalled()
  })
})
