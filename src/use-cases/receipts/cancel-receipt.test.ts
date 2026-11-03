import { beforeEach, describe, expect, it, vi } from 'vitest'

const lockFamilyForPayment = vi.fn()
const sumActiveByEnrollment = vi.fn()
const deactivateMany = vi.fn()

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: {
    lockFamilyForPayment: (...args: unknown[]) => lockFamilyForPayment(...args),
    sumActiveByEnrollment: (...args: unknown[]) => sumActiveByEnrollment(...args),
    deactivateMany: (...args: unknown[]) => deactivateMany(...args),
  },
}))

const { cancelReceipt } = await import('./cancel-receipt')

type ReceiptGw = Parameters<typeof cancelReceipt>[1]
type ConfigGw = Parameters<typeof cancelReceipt>[2]

const schoolId = 'school-a'
const receiptId = '5d1c9a2e-8b7f-4e3d-a6c5-b4a39281706f'
const tx = { tx: true }

function setup() {
  const receiptGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findPayer: vi.fn().mockResolvedValue({ familyId: 'family-1', staffMemberId: null }),
    lockForCancel: vi.fn().mockResolvedValue({ familyId: 'family-1', cancelledAt: null }),
    findActivePayments: vi
      .fn()
      .mockResolvedValue([{ id: 'payment-1', enrollmentId: 'enrollment-1' }]),
    markCancelled: vi.fn(),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  const run = (input: Partial<Parameters<typeof cancelReceipt>[0]> = {}) =>
    cancelReceipt(
      { schoolId, cancelledById: 'admin-1', receiptId, reason: 'Erreur de saisie', ...input },
      receiptGw as unknown as ReceiptGw,
      configGw as unknown as ConfigGw
    )
  return { receiptGw, run }
}

beforeEach(() => {
  vi.clearAllMocks()
  lockFamilyForPayment.mockResolvedValue(true)
  sumActiveByEnrollment.mockResolvedValue(new Map())
})

describe('cancelReceipt', () => {
  it('locks the family, deactivates the tuition and keeps the receipt with its reason', async () => {
    const { receiptGw, run } = setup()

    expect(await run()).toBe('OK')
    expect(lockFamilyForPayment).toHaveBeenCalledWith(tx, schoolId, 'family-1')
    expect(deactivateMany).toHaveBeenCalledWith(tx, schoolId, ['payment-1'])
    expect(receiptGw.markCancelled).toHaveBeenCalledWith(tx, schoolId, receiptId, {
      cancelledById: 'admin-1',
      cancelReason: 'Erreur de saisie',
    })
  })

  it('cancels a meals-only receipt without touching payments', async () => {
    const { receiptGw, run } = setup()
    receiptGw.findActivePayments.mockResolvedValue([])

    expect(await run()).toBe('OK')
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('refuses a receipt cancelled twice', async () => {
    const { receiptGw, run } = setup()
    receiptGw.lockForCancel.mockResolvedValue({ familyId: 'family-1', cancelledAt: new Date() })

    expect(await run()).toBe('alreadyCancelled')
    expect(receiptGw.markCancelled).not.toHaveBeenCalled()
  })

  it('refuses when an active refund would exceed what remains paid', async () => {
    const { receiptGw, run } = setup()
    sumActiveByEnrollment.mockResolvedValue(new Map([['enrollment-1', -50]]))

    expect(await run()).toBe('refundExceedsPaid')
    expect(receiptGw.markCancelled).not.toHaveBeenCalled()
  })

  it('refuses an unknown receipt', async () => {
    const { receiptGw, run } = setup()
    receiptGw.findPayer.mockResolvedValue(null)

    expect(await run()).toBe('notFound')
  })

  it('refuses a family archived by a concurrent merge before cancelling anything', async () => {
    const { receiptGw, run } = setup()
    lockFamilyForPayment.mockResolvedValue(false)
    expect(await run()).toBe('notFound')
    expect(receiptGw.lockForCancel).not.toHaveBeenCalled()
    expect(deactivateMany).not.toHaveBeenCalled()
  })

  it('refuses a receipt moved to another family after the initial lookup', async () => {
    const { receiptGw, run } = setup()
    receiptGw.lockForCancel.mockResolvedValue({ familyId: 'target-family', cancelledAt: null })
    expect(await run()).toBe('notFound')
    expect(receiptGw.findActivePayments).not.toHaveBeenCalled()
    expect(receiptGw.markCancelled).not.toHaveBeenCalled()
  })

  it('cancels a staff receipt without locking any family', async () => {
    const { receiptGw, run } = setup()
    receiptGw.findPayer.mockResolvedValue({ familyId: null, staffMemberId: 'staff-1' })
    receiptGw.lockForCancel.mockResolvedValue({ familyId: null, cancelledAt: null })
    receiptGw.findActivePayments.mockResolvedValue([])

    expect(await run()).toBe('OK')
    expect(lockFamilyForPayment).not.toHaveBeenCalled()
    expect(receiptGw.markCancelled).toHaveBeenCalled()
  })

  it('requires a reason', async () => {
    const { run } = setup()

    expect(await run({ reason: '  ' })).toBe('validationError')
  })
})
