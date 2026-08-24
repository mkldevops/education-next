import { beforeEach, describe, expect, it, vi } from 'vitest'

const txMock = {
  paymentProviderEvent: { create: vi.fn() },
  payment: { createMany: vi.fn() },
  paymentTransaction: { update: vi.fn() },
}
const dbMock = {
  paymentProviderEvent: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}
const findPaymentTransactionByProviderSessionIdMock = vi.fn()
const getFamilyBalanceMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/db-unscoped', () => ({
  findPaymentTransactionByProviderSessionId: findPaymentTransactionByProviderSessionIdMock,
}))
vi.mock('./family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))

const { completeCheckoutSession } = await import('./complete-checkout-session')

const transaction = {
  id: 'transaction-1',
  schoolId: 'school-1',
  familyId: 'family-1',
  amount: 100,
  currency: 'EUR',
  status: 'PENDING',
}
const input = {
  providerEventId: 'evt_1',
  eventType: 'checkout.session.completed',
  session: {
    id: 'cs_1',
    amount_total: 10000,
    currency: 'eur',
    payment_status: 'paid',
    payment_intent: 'pi_1',
  },
}

describe('completeCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.paymentProviderEvent.findUnique.mockResolvedValue(null)
    findPaymentTransactionByProviderSessionIdMock.mockResolvedValue(transaction)
    getFamilyBalanceMock.mockResolvedValue({
      payableEnrollments: [
        {
          enrollmentId: 'enrollment-1',
          totalAmount: 60,
          discount: 0,
          remainingBalance: 60,
        },
        {
          enrollmentId: 'enrollment-2',
          totalAmount: 40,
          discount: 0,
          remainingBalance: 40,
        },
      ],
    })
    dbMock.$transaction.mockImplementation(async (callback) => callback(txMock))
  })

  it('creates allocations and marks the transaction succeeded atomically', async () => {
    expect(await completeCheckoutSession(input)).toBe('OK')

    expect(findPaymentTransactionByProviderSessionIdMock).toHaveBeenCalledWith('cs_1')
    expect(getFamilyBalanceMock).toHaveBeenCalledWith('school-1', 'family-1')
    expect(txMock.paymentProviderEvent.create).toHaveBeenCalledWith({
      data: {
        providerEventId: 'evt_1',
        type: 'checkout.session.completed',
        paymentTransactionId: 'transaction-1',
      },
    })
    expect(txMock.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          schoolId: 'school-1',
          enrollmentId: 'enrollment-1',
          familyId: 'family-1',
          paymentTransactionId: 'transaction-1',
          amount: 60,
          method: 'STRIPE',
        }),
        expect.objectContaining({
          schoolId: 'school-1',
          enrollmentId: 'enrollment-2',
          familyId: 'family-1',
          paymentTransactionId: 'transaction-1',
          amount: 40,
          method: 'STRIPE',
        }),
      ],
    })
    expect(txMock.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'transaction-1', schoolId: 'school-1' } },
      data: expect.objectContaining({
        status: 'SUCCEEDED',
        providerPaymentId: 'pi_1',
      }),
    })
  })

  it('ignores a provider event that was already processed', async () => {
    dbMock.paymentProviderEvent.findUnique.mockResolvedValue({ id: 'provider-event-1' })

    expect(await completeCheckoutSession(input)).toBe('duplicate')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a checkout amount mismatch', async () => {
    expect(
      await completeCheckoutSession({
        ...input,
        session: { ...input.session, amount_total: 9999 },
      })
    ).toBe('amountMismatch')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an unpaid checkout', async () => {
    expect(
      await completeCheckoutSession({
        ...input,
        session: { ...input.session, payment_status: 'unpaid' },
      })
    ).toBe('notPaid')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })
})
