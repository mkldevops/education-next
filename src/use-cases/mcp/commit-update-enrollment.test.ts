import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()

const tx = {
  enrollment: { findFirst: vi.fn(), update: vi.fn() },
  plan: { findFirst: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

const { commitUpdateEnrollment } = await import('./commit-update-enrollment')

const scope = {
  credentialId: 'key-1',
  credentialPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const resolved = {
  tool: 'update_enrollment',
  enrollment: { id: 'enr-1', student: 'Ben Manzil', status: 'PENDING', classes: [], plan: 'Basic' },
  before: { plan: { id: 'plan-basic', name: 'Basic', amount: 180 }, discount: 0, totalAmount: 180 },
  after: { plan: { id: 'plan-grand', name: 'Grand', amount: 90 }, discount: 0, totalAmount: 90 },
  paid: 50,
  remaining: 40,
}

const input = { draftId: '33333333-3333-4333-8333-333333333333', checksum: 'abcdef012345' }

beforeEach(() => {
  vi.clearAllMocks()
  claim.mockResolvedValue({ count: 1 })
  findById.mockResolvedValue({
    ownerKind: 'MCP_KEY',
    keyId: 'key-1',
    userId: null,
    tool: 'update_enrollment',
    checksum: input.checksum,
    resolved,
  })
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  tx.enrollment.findFirst.mockResolvedValue({
    planId: 'plan-basic',
    discount: 0,
    totalAmount: 180,
    payments: [{ amount: 50 }],
  })
  tx.plan.findFirst.mockResolvedValue({ amount: 90 })
  tx.enrollment.update.mockResolvedValue({})
  tx.mcpDraft.updateMany.mockResolvedValue({ count: 1 })
})

describe('commitUpdateEnrollment', () => {
  it('writes the plan, discount and total the caller validated', async () => {
    const result = await commitUpdateEnrollment(scope, input)

    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'enr-1', schoolId: 'school-1' } },
      data: { planId: 'plan-grand', discount: 0, totalAmount: 90, startMonth: null },
    })
    expect(result).toEqual({
      enrollmentId: 'enr-1',
      planId: 'plan-grand',
      discount: 0,
      totalAmount: 90,
      startMonth: null,
      remaining: 40,
    })
    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: input.draftId, schoolId: 'school-1' },
      data: { result },
    })
  })

  it('refuses without claiming the draft when payments are disabled, even a pre-cutoff one', async () => {
    const result = await commitUpdateEnrollment({ ...scope, paymentsEnabled: false }, input)

    expect(result).toBe('paymentsDisabled')
    expect(claim).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses an enrollment changed since the preview', async () => {
    tx.enrollment.findFirst.mockResolvedValue({
      planId: 'plan-basic',
      discount: 20,
      totalAmount: 160,
      payments: [],
    })

    expect(await commitUpdateEnrollment(scope, input)).toBe('staleDraft')
    expect(tx.enrollment.update).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('refuses a target plan whose price moved since the preview', async () => {
    tx.plan.findFirst.mockResolvedValue({ amount: 100 })

    expect(await commitUpdateEnrollment(scope, input)).toBe('staleDraft')
    expect(tx.enrollment.update).not.toHaveBeenCalled()
  })

  it('refuses an enrollment no longer open, or a plan no longer active', async () => {
    tx.enrollment.findFirst.mockResolvedValueOnce(null)
    expect(await commitUpdateEnrollment(scope, input)).toBe('notFound')

    tx.plan.findFirst.mockResolvedValueOnce(null)
    expect(await commitUpdateEnrollment(scope, input)).toBe('notFound')
    expect(tx.enrollment.update).not.toHaveBeenCalled()
  })

  it('refuses a total a payment banked since the preview now exceeds', async () => {
    tx.enrollment.findFirst.mockResolvedValue({
      planId: 'plan-basic',
      discount: 0,
      totalAmount: 180,
      payments: [{ amount: 50 }, { amount: 50 }],
    })

    expect(await commitUpdateEnrollment(scope, input)).toBe('totalBelowPaid')
    expect(tx.enrollment.update).not.toHaveBeenCalled()
  })

  it('writes the start month the preview resolved', async () => {
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'update_enrollment',
      checksum: input.checksum,
      resolved: {
        ...resolved,
        after: { ...resolved.after, startMonth: '2026-10' },
      },
    })

    const result = await commitUpdateEnrollment(scope, input)

    expect(tx.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startMonth: new Date('2026-10-01T00:00:00.000Z') }),
      })
    )
    expect(result).toMatchObject({ startMonth: '2026-10' })
  })

  it('refuses an enrollment whose start month changed since the preview', async () => {
    tx.enrollment.findFirst.mockResolvedValue({
      planId: 'plan-basic',
      discount: 0,
      totalAmount: 180,
      startMonth: new Date('2026-11-01T00:00:00Z'),
      payments: [{ amount: 50 }],
    })

    expect(await commitUpdateEnrollment(scope, input)).toBe('staleDraft')
    expect(tx.enrollment.update).not.toHaveBeenCalled()
  })

  it('gives the lock back when the transaction blows up', async () => {
    transaction.mockRejectedValue(new Error('connection lost'))

    await expect(commitUpdateEnrollment(scope, input)).rejects.toThrow('connection lost')
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('returns the recorded result on a replay instead of writing again', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'update_enrollment',
      checksum: input.checksum,
      status: 'COMMITTED',
      result: { enrollmentId: 'enr-1' },
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitUpdateEnrollment(scope, input)).toEqual({ enrollmentId: 'enr-1' })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a draft prepared by another tool', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitUpdateEnrollment(scope, input)).toBe('draftNotFound')
  })
})
