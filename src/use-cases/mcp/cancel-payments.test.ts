import { beforeEach, describe, expect, it, vi } from 'vitest'

const findActiveByIds = vi.fn()
const lockFamilyForPayment = vi.fn()
const sumActiveByEnrollment = vi.fn()
const deactivateMany = vi.fn()
const tx = {}

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { findActiveByIds, lockFamilyForPayment, sumActiveByEnrollment, deactivateMany },
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

const payment = (
  id: string,
  amount: number,
  familyId = 'family-1',
  online = false,
  enrollmentId = 'enrollment-1'
) => ({
  id,
  familyId,
  enrollmentId,
  amount,
  paymentTransactionId: online ? 'tx-1' : null,
})

beforeEach(() => {
  vi.clearAllMocks()
  findActiveByIds.mockResolvedValue([payment(idA, 90), payment(idB, 30.5)])
  lockFamilyForPayment.mockResolvedValue(true)
  sumActiveByEnrollment.mockResolvedValue(new Map())
  deactivateMany.mockResolvedValue({ count: 2 })
})

describe('cancelPaymentsFromMcp', () => {
  it('deactivates the payments under the family lock and reports the amount given back', async () => {
    const result = await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })

    expect(result).toEqual({ familyId: 'family-1', cancelledPaymentIds: [idA, idB], amount: 120.5 })
    expect(lockFamilyForPayment).toHaveBeenCalledWith(tx, 'school-1', 'family-1')
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(tx, 'school-1', ['enrollment-1'], [idA, idB])
    expect(deactivateMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB])
  })

  it('refuses to cancel a payment when an active refund would leave the enrollment negative', async () => {
    // Inscription 100 € : +100 (idA) puis −100 (idB). Annuler seulement +100 laisserait −100.
    findActiveByIds.mockResolvedValue([payment(idA, 100)])
    sumActiveByEnrollment.mockResolvedValue(new Map([['enrollment-1', -100]]))

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA] })).toBe(
      'refundExceedsPaid'
    )
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(tx, 'school-1', ['enrollment-1'], [idA])
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('checks every enrollment touched by the cancelled payments', async () => {
    findActiveByIds.mockResolvedValue([
      payment(idA, 60, 'family-1', false, 'enrollment-1'),
      payment(idB, 40, 'family-1', false, 'enrollment-2'),
    ])
    sumActiveByEnrollment.mockResolvedValue(
      new Map([
        ['enrollment-1', 20],
        ['enrollment-2', -40],
      ])
    )

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })).toBe(
      'refundExceedsPaid'
    )
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(
      tx,
      'school-1',
      ['enrollment-1', 'enrollment-2'],
      [idA, idB]
    )
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('cancels a payment and its refund together, the enrollment ending at zero', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 100), payment(idB, -100)])
    sumActiveByEnrollment.mockResolvedValue(new Map())

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idA, idB] })).toEqual({
      familyId: 'family-1',
      cancelledPaymentIds: [idA, idB],
      amount: 0,
    })
    expect(deactivateMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB])
  })

  it('cancels a refund alone, which only raises the amount paid', async () => {
    findActiveByIds.mockResolvedValue([payment(idB, -40)])
    sumActiveByEnrollment.mockResolvedValue(new Map([['enrollment-1', 100]]))

    expect(await cancelPaymentsFromMcp(scope as never, { paymentIds: [idB] })).toEqual({
      familyId: 'family-1',
      cancelledPaymentIds: [idB],
      amount: -40,
    })
    expect(deactivateMany).toHaveBeenCalledWith(tx, 'school-1', [idB])
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
