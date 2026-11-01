import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkoutLock = vi.fn()
vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { tryLockFamilyCheckout: checkoutLock },
}))

const tx = {
  $queryRaw: vi.fn(),
  family: { findMany: vi.fn(), update: vi.fn() },
  familyPerson: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  userFamily: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  payment: { updateMany: vi.fn() },
  receipt: { updateMany: vi.fn() },
  paymentTransaction: { count: vi.fn(), updateMany: vi.fn() },
  invitation: { updateMany: vi.fn() },
}
const transaction = vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
vi.mock('@/lib/db', () => ({ dbArchived: { $transaction: transaction } }))
const { mergeFamilies } = await import('./merge-families')
const sourceId = '550e8400-e29b-41d4-a716-446655440000'
const targetId = '550e8400-e29b-41d4-a716-446655440001'
const input = { schoolId: 'school', sourceId, targetId }
const family = {
  emergencyContactName: null,
  emergencyContactPhone: null,
  authorizedPickup: null,
  languagesAtHome: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  checkoutLock.mockResolvedValue(true)
  tx.familyPerson.findFirst.mockResolvedValue(null)
  tx.family.findMany.mockResolvedValue([
    { ...family, id: sourceId },
    { ...family, id: targetId },
  ])
  tx.familyPerson.findMany.mockResolvedValue([])
  tx.userFamily.findMany.mockResolvedValue([])
  tx.paymentTransaction.count.mockResolvedValue(0)
})

describe('mergeFamilies', () => {
  it('rejects invalid and self merges without a database call', async () => {
    expect(await mergeFamilies({ ...input, sourceId: 'bad' })).toBe('validationError')
    expect(await mergeFamilies({ ...input, targetId: sourceId })).toBe('sameFamily')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('refuses missing, archived or foreign-school families', async () => {
    tx.family.findMany.mockResolvedValue([{ ...family, id: targetId }])
    expect(await mergeFamilies(input)).toBe('notFound')
    expect(tx.family.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: 'school',
        id: { in: [sourceId, targetId] },
        isActive: true,
      },
    })
    expect(tx.family.update).not.toHaveBeenCalled()
  })
  it('blocks a checkout being opened concurrently', async () => {
    checkoutLock.mockResolvedValueOnce(false)
    expect(await mergeFamilies(input)).toBe('pendingPayment')
    expect(tx.family.findMany).not.toHaveBeenCalled()
  })
  it('blocks pending checkouts before any write', async () => {
    tx.paymentTransaction.count.mockResolvedValue(1)
    expect(await mergeFamilies(input)).toBe('pendingPayment')
    expect(tx.familyPerson.upsert).not.toHaveBeenCalled()
    expect(tx.family.update).not.toHaveBeenCalled()
  })
  it('refuses conflicting family information', async () => {
    tx.family.findMany.mockResolvedValue([
      { ...family, id: sourceId, emergencyContactPhone: '123456' },
      { ...family, id: targetId, emergencyContactPhone: '654321' },
    ])
    expect(await mergeFamilies(input)).toBe('familyDetailsConflict')
    expect(tx.payment.updateMany).not.toHaveBeenCalled()
  })
  it('refuses conflicting relationship types without transferring data', async () => {
    tx.familyPerson.findMany.mockResolvedValue([
      { familyId: sourceId, personId: 'child', relationType: 'OTHER' },
      { familyId: targetId, personId: 'child', relationType: 'PARENT' },
    ])
    expect(await mergeFamilies(input)).toBe('relationConflict')
    expect(tx.familyPerson.upsert).not.toHaveBeenCalled()
  })
  it('refuses third-family links so merging cannot change an unlocked debtor', async () => {
    tx.familyPerson.findMany.mockResolvedValue([
      { familyId: sourceId, personId: 'child', relationType: 'OTHER' },
    ])
    tx.familyPerson.findFirst.mockResolvedValue({ personId: 'child' })
    expect(await mergeFamilies(input)).toBe('sharedMember')
    expect(tx.familyPerson.findFirst).toHaveBeenCalledWith({
      where: {
        schoolId: 'school',
        personId: { in: ['child'] },
        familyId: { notIn: [sourceId, targetId] },
      },
      select: { personId: true },
    })
    expect(tx.payment.updateMany).not.toHaveBeenCalled()
    expect(tx.family.update).not.toHaveBeenCalled()
  })

  it('moves all history and access, deduplicates links and archives only the source', async () => {
    tx.family.findMany.mockResolvedValue([
      { ...family, id: sourceId, emergencyContactName: 'Contact', languagesAtHome: ['fr', 'ar'] },
      { ...family, id: targetId, languagesAtHome: ['fr'] },
    ])
    tx.familyPerson.findMany.mockResolvedValue([
      { familyId: sourceId, personId: 'child', relationType: 'OTHER' },
      { familyId: targetId, personId: 'child', relationType: 'OTHER' },
    ])
    tx.userFamily.findMany.mockResolvedValue([{ userId: 'parent' }])
    expect(await mergeFamilies(input)).toBe('OK')
    for (const model of [tx.payment, tx.receipt, tx.paymentTransaction, tx.invitation]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { schoolId: 'school', familyId: sourceId },
        data: { familyId: targetId },
      })
    }
    expect(tx.familyPerson.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          schoolId: 'school',
          familyId: targetId,
          personId: 'child',
          relationType: 'OTHER',
        },
        update: {},
      })
    )
    expect(tx.userFamily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { schoolId: 'school', familyId: targetId, userId: 'parent' },
      })
    )
    expect(tx.family.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: targetId, schoolId: 'school' } },
      data: {
        emergencyContactName: 'Contact',
        emergencyContactPhone: null,
        authorizedPickup: null,
        languagesAtHome: ['fr', 'ar'],
      },
    })
    expect(tx.family.update).toHaveBeenLastCalledWith({
      where: { id_schoolId: { id: sourceId, schoolId: 'school' } },
      data: { isActive: false },
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    })
  })
  it('returns a retryable conflict if the atomic transaction is aborted', async () => {
    transaction.mockRejectedValueOnce({ code: 'P2034' })
    expect(await mergeFamilies(input)).toBe('mergeConflict')
  })
})
