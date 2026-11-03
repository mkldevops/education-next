import { beforeEach, describe, expect, it, vi } from 'vitest'

const findActiveByIds = vi.fn()
const lockFamilyForPayment = vi.fn()
const sumActiveByEnrollment = vi.fn()
const cancelMany = vi.fn()
const tx = {}

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { findActiveByIds, lockFamilyForPayment, sumActiveByEnrollment, cancelMany },
}))
vi.mock('@/lib/db', () => ({
  db: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
}))

const { cancelPayments } = await import('./cancel-payments')

const configGw = { get: vi.fn() }
const base = { schoolId: 'school-1', cancelledById: 'user-1' }
const audit = { cancelledById: 'user-1', cancelReason: null }

const cancel = (input: { paymentIds: string[]; reason?: string }) =>
  cancelPayments({ ...base, ...input }, configGw as never)

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
  receiptId: null as string | null,
})

beforeEach(() => {
  vi.clearAllMocks()
  findActiveByIds.mockResolvedValue([payment(idA, 90), payment(idB, 30.5)])
  lockFamilyForPayment.mockResolvedValue(true)
  sumActiveByEnrollment.mockResolvedValue(new Map())
  cancelMany.mockResolvedValue({ count: 2 })
  configGw.get.mockResolvedValue({ value: 'true' })
})

describe('cancelPayments', () => {
  it('deactivates the payments under the family lock and reports the amount given back', async () => {
    const result = await cancel({ paymentIds: [idA, idB] })

    expect(result).toEqual({ familyId: 'family-1', cancelledPaymentIds: [idA, idB], amount: 120.5 })
    expect(lockFamilyForPayment).toHaveBeenCalledWith(tx, 'school-1', 'family-1')
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(tx, 'school-1', ['enrollment-1'], [idA, idB])
    expect(cancelMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB], audit)
  })

  it('refuses to cancel a payment when an active refund would leave the enrollment negative', async () => {
    // Inscription 100 € : +100 (idA) puis −100 (idB). Annuler seulement +100 laisserait −100.
    findActiveByIds.mockResolvedValue([payment(idA, 100)])
    sumActiveByEnrollment.mockResolvedValue(new Map([['enrollment-1', -100]]))

    expect(await cancel({ paymentIds: [idA] })).toBe('refundExceedsPaid')
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(tx, 'school-1', ['enrollment-1'], [idA])
    expect(cancelMany).not.toHaveBeenCalled()
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

    expect(await cancel({ paymentIds: [idA, idB] })).toBe('refundExceedsPaid')
    expect(sumActiveByEnrollment).toHaveBeenCalledWith(
      tx,
      'school-1',
      ['enrollment-1', 'enrollment-2'],
      [idA, idB]
    )
    expect(cancelMany).not.toHaveBeenCalled()
  })

  it('cancels a payment and its refund together, the enrollment ending at zero', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 100), payment(idB, -100)])
    sumActiveByEnrollment.mockResolvedValue(new Map())

    expect(await cancel({ paymentIds: [idA, idB] })).toEqual({
      familyId: 'family-1',
      cancelledPaymentIds: [idA, idB],
      amount: 0,
    })
    expect(cancelMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB], audit)
  })

  it('cancels a refund alone, which only raises the amount paid', async () => {
    findActiveByIds.mockResolvedValue([payment(idB, -40)])
    sumActiveByEnrollment.mockResolvedValue(new Map([['enrollment-1', 100]]))

    expect(await cancel({ paymentIds: [idB] })).toEqual({
      familyId: 'family-1',
      cancelledPaymentIds: [idB],
      amount: -40,
    })
    expect(cancelMany).toHaveBeenCalledWith(tx, 'school-1', [idB], audit)
  })

  it('refuses when one payment is missing, inactive or from another school', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90)])

    expect(await cancel({ paymentIds: [idA, idB] })).toBe('notFound')
    expect(cancelMany).not.toHaveBeenCalled()
  })

  it('refuses when a concurrent cancellation won the lock', async () => {
    findActiveByIds
      .mockResolvedValueOnce([payment(idA, 90), payment(idB, 30)])
      .mockResolvedValueOnce([payment(idA, 90)])

    expect(await cancel({ paymentIds: [idA, idB] })).toBe('notFound')
    expect(cancelMany).not.toHaveBeenCalled()
  })

  it('refuses an online payment, refunded at the provider instead', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90, 'family-1', true)])

    expect(await cancel({ paymentIds: [idA] })).toBe('onlinePayment')
    expect(lockFamilyForPayment).not.toHaveBeenCalled()
  })

  it('refuses a cashier payment, cancelled with its receipt instead', async () => {
    findActiveByIds.mockResolvedValue([{ ...payment(idA, 90), receiptId: 'receipt-1' }])

    expect(await cancel({ paymentIds: [idA] })).toBe('receiptPayment')
    expect(lockFamilyForPayment).not.toHaveBeenCalled()
  })

  it('refuses payments spread over two families', async () => {
    findActiveByIds.mockResolvedValue([payment(idA, 90), payment(idB, 30, 'family-2')])

    expect(await cancel({ paymentIds: [idA, idB] })).toBe('mixedFamilies')
  })

  it('refuses without reading anything when payments are disabled', async () => {
    configGw.get.mockResolvedValue({ value: 'false' })

    expect(await cancel({ paymentIds: [idA] })).toBe('paymentsDisabled')
    expect(findActiveByIds).not.toHaveBeenCalled()
  })

  it('records who cancelled and why', async () => {
    await cancel({ paymentIds: [idA, idB], reason: '  Saisi en double  ' })

    expect(cancelMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB], {
      cancelledById: 'user-1',
      cancelReason: 'Saisi en double',
    })
  })

  it('stores no reason for a blank one', async () => {
    await cancel({ paymentIds: [idA, idB], reason: '   ' })

    expect(cancelMany).toHaveBeenCalledWith(tx, 'school-1', [idA, idB], audit)
  })

  it('rejects a reason longer than the column', async () => {
    expect(await cancel({ paymentIds: [idA], reason: 'x'.repeat(251) })).toBe('validationError')
  })

  it('rejects an empty list', async () => {
    expect(await cancel({ paymentIds: [] })).toBe('validationError')
  })
})
