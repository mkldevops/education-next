import { beforeEach, describe, expect, it, vi } from 'vitest'

const findActiveByIds = vi.fn()
const lockFamilyForPayment = vi.fn()
const deactivateMany = vi.fn()
const tx = {}

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { findActiveByIds, lockFamilyForPayment, deactivateMany },
}))
vi.mock('@/lib/db', () => ({
  db: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
}))

const { cancelPaymentsFromMcp } = await import('./cancel-payments')

const scope = {
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}

const idA = '11111111-1111-4111-8111-111111111111'
const idB = '22222222-2222-4222-8222-222222222222'

const payment = (id: string, amount: number, familyId = 'family-1', online = false) => ({
  id,
  familyId,
  amount,
  paymentTransactionId: online ? 'tx-1' : null,
})

beforeEach(() => {
  vi.clearAllMocks()
  findActiveByIds.mockResolvedValue([payment(idA, 90), payment(idB, 30.5)])
  lockFamilyForPayment.mockResolvedValue(true)
  deactivateMany.mockResolvedValue({ count: 2 })
})

describe('cancelPaymentsFromMcp', () => {
  it('deactivates the payments under the family lock and reports the amount given back', async () => {
    const result = await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })

    expect(result).toEqual({ familyId: 'family-1', cancelledPaymentIds: [idA, idB], amount: 120.5 })
    expect(lockFamilyForPayment).toHaveBeenCalledWith(tx, 'school-1', 'family-1')
    expect(deactivateMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB])
  })

  it('refuses when one payment is missing, inactive or from another school', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90)])

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })).toBe('notFound')
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('refuses when a concurrent cancellation won the lock', async () => {
    findActiveByIds
      .mockResolvedValueOnce([payment(idA, 90), payment(idB, 30)])
      .mockResolvedValueOnce([payment(idA, 90)])

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })).toBe('notFound')
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('refuses an online payment, refunded at the provider instead', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90, 'family-1', true)])

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA] })).toBe('onlinePayment')
    expect(lockFamilyForPayment).not.toHaveBeenCalled()
  })

  it('refuses payments spread over two families', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90), payment(idB, 30, 'family-2')])

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })).toBe(
      'mixedFamilies'
    )
  })

  it('refuses without reading anything when payments are disabled', async () => {
    const result = await cancelPaymentsFromMcp({ ...scope, paymentsEnabled: false } as never, {
      paymentIds: [idA],
    })

    expect(result).toBe('paymentsDisabled')
    expect(findActiveByIds).not.toHaveBeenCalled()
  })

  it('rejects an empty list', async () => {
    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [] })).toBe('validationError')
  })
})
