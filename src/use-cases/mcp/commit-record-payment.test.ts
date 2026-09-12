import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()

const tx = {
  enrollment: { findMany: vi.fn() },
  payment: { create: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

const { commitRecordPayment } = await import('./commit-record-payment')

const scope = {
  keyId: 'key-1',
  keyPrefix: 'edu_mcp_aaaa',
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
}

const resolved = {
  tool: 'record_payment',
  family: { id: 'family-1', name: 'Madi' },
  method: 'CASH',
  reference: '34-45',
  paidAt: '2026-09-12T00:00:00.000Z',
  amount: 180,
  allocation: [
    { enrollmentId: 'enr-1', amount: 90 },
    { enrollmentId: 'enr-2', amount: 90 },
  ],
}

const input = { draftId: '33333333-3333-4333-8333-333333333333', checksum: 'abcdef012345' }

function enrollment(id: string, totalAmount: number, paid: number[] = []) {
  return {
    id,
    totalAmount,
    discount: 0,
    payments: paid.map((amount) => ({ amount })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  claim.mockResolvedValue({ count: 1 })
  findById.mockResolvedValue({
    keyId: 'key-1',
    tool: 'record_payment',
    checksum: input.checksum,
    resolved,
  })
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  tx.enrollment.findMany.mockResolvedValue([enrollment('enr-1', 90), enrollment('enr-2', 90)])
  tx.payment.create
    .mockResolvedValueOnce({ id: 'payment-1' })
    .mockResolvedValueOnce({ id: 'payment-2' })
  tx.mcpDraft.updateMany.mockResolvedValue({ count: 1 })
})

describe('commitRecordPayment', () => {
  it('writes the split the caller validated', async () => {
    const result = await commitRecordPayment(scope, input)

    expect(tx.payment.create).toHaveBeenCalledTimes(2)
    expect(tx.payment.create).toHaveBeenNthCalledWith(1, {
      data: {
        schoolId: 'school-1',
        familyId: 'family-1',
        enrollmentId: 'enr-1',
        amount: 90,
        method: 'CASH',
        reference: '34-45',
        paidAt: new Date(resolved.paidAt),
        cashedAt: undefined,
      },
      select: { id: true },
    })
    expect(result).toEqual({
      familyId: 'family-1',
      amount: 180,
      paymentIds: ['payment-1', 'payment-2'],
    })
  })

  it('pays enrollments still awaiting validation', async () => {
    await commitRecordPayment(scope, input)

    expect(tx.enrollment.findMany.mock.calls[0][0].where.status).toEqual({
      in: ['PENDING', 'ACTIVE'],
    })
  })

  it('writes the result inside the transaction that writes the payments', async () => {
    const result = await commitRecordPayment(scope, input)

    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: input.draftId, schoolId: 'school-1' },
      data: { result },
    })
  })

  it('refuses a second draft drawn on a balance the first one consumed', async () => {
    tx.enrollment.findMany.mockResolvedValue([
      enrollment('enr-1', 90, [90]),
      enrollment('enr-2', 90, [90]),
    ])

    expect(await commitRecordPayment(scope, input)).toBe('overpayment')
    expect(tx.payment.create).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('refuses a split that no longer matches the fresh balances', async () => {
    tx.enrollment.findMany.mockResolvedValue([
      enrollment('enr-1', 120),
      enrollment('enr-2', 120),
      enrollment('enr-3', 120),
    ])

    expect(await commitRecordPayment(scope, input)).toBe('staleDraft')
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  it('gives the lock back when the transaction blows up', async () => {
    transaction.mockRejectedValue(new Error('connection lost'))

    await expect(commitRecordPayment(scope, input)).rejects.toThrow('connection lost')
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('returns the recorded result on a replay instead of banking twice', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'COMMITTED',
      result: { familyId: 'family-1', amount: 180, paymentIds: ['payment-1'] },
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordPayment(scope, input)).toEqual({
      familyId: 'family-1',
      amount: 180,
      paymentIds: ['payment-1'],
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a checksum altered by a single character', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'record_payment',
      checksum: 'abcdef012346',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordPayment(scope, input)).toBe('checksumMismatch')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses an expired draft', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1),
    })

    expect(await commitRecordPayment(scope, input)).toBe('draftExpired')
  })

  it('refuses a draft proposed by another key of the same school', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-2',
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordPayment(scope, input)).toBe('draftNotFound')
  })

  it('refuses an enrolment draft presented to the payment commit', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      keyId: 'key-1',
      tool: 'enroll_family',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordPayment(scope, input)).toBe('draftNotFound')
  })

  it('rejects a malformed checksum without touching the lock', async () => {
    expect(await commitRecordPayment(scope, { draftId: input.draftId, checksum: 'short' })).toBe(
      'validationError'
    )
    expect(claim).not.toHaveBeenCalled()
  })
})
