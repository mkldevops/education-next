import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const recordResult = vi.fn()
const createInTransaction = vi.fn()

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, recordResult },
}))
vi.mock('@/gateways/payment-gateway', () => ({ paymentGateway: { createInTransaction } }))

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

beforeEach(() => {
  vi.clearAllMocks()
  claim.mockResolvedValue({ count: 1 })
  findById.mockResolvedValue({ tool: 'record_payment', checksum: input.checksum, resolved })
  createInTransaction.mockResolvedValue([{ id: 'payment-1' }, { id: 'payment-2' }])
})

describe('commitRecordPayment', () => {
  it('writes the split it was shown, without recomputing it', async () => {
    const result = await commitRecordPayment(scope, input)

    expect(createInTransaction).toHaveBeenCalledWith('school-1', [
      {
        familyId: 'family-1',
        enrollmentId: 'enr-1',
        amount: 90,
        method: 'CASH',
        reference: '34-45',
        paidAt: new Date(resolved.paidAt),
        cashedAt: undefined,
      },
      {
        familyId: 'family-1',
        enrollmentId: 'enr-2',
        amount: 90,
        method: 'CASH',
        reference: '34-45',
        paidAt: new Date(resolved.paidAt),
        cashedAt: undefined,
      },
    ])
    expect(result).toEqual({
      familyId: 'family-1',
      amount: 180,
      paymentIds: ['payment-1', 'payment-2'],
    })
  })

  it('records the result so a replay has something to return', async () => {
    const result = await commitRecordPayment(scope, input)

    expect(recordResult).toHaveBeenCalledWith('school-1', input.draftId, result)
  })

  it('returns the recorded result on a replay instead of banking twice', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
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
    expect(createInTransaction).not.toHaveBeenCalled()
  })

  it('refuses a checksum altered by a single character', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      tool: 'record_payment',
      checksum: 'abcdef012346',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(await commitRecordPayment(scope, input)).toBe('checksumMismatch')
    expect(createInTransaction).not.toHaveBeenCalled()
  })

  it('refuses an expired draft', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
      tool: 'record_payment',
      checksum: input.checksum,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1),
    })

    expect(await commitRecordPayment(scope, input)).toBe('draftExpired')
  })

  it('refuses an enrolment draft presented to the payment commit', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue({
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
