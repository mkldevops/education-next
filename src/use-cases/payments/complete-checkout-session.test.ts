import { beforeEach, describe, expect, it, vi } from 'vitest'

const txMock = {
  paymentProviderEvent: { create: vi.fn() },
  payment: { createMany: vi.fn() },
  paymentTransaction: { updateMany: vi.fn() },
}
const dbMock = {
  paymentProviderEvent: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}
const findPaymentTransactionByProviderSessionIdMock = vi.fn()
const getFamilyBalanceMock = vi.fn()
const findLatestFamilyEnrollmentIdMock = vi.fn()
const lockFamilyForPaymentMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/db-unscoped', () => ({
  findPaymentTransactionByProviderSessionId: findPaymentTransactionByProviderSessionIdMock,
}))
vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { lockFamilyForPayment: lockFamilyForPaymentMock },
}))
vi.mock('./family-balance', () => ({
  getFamilyBalance: getFamilyBalanceMock,
  findLatestFamilyEnrollmentId: findLatestFamilyEnrollmentIdMock,
}))

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
    txMock.paymentTransaction.updateMany.mockResolvedValue({ count: 1 })
    findLatestFamilyEnrollmentIdMock.mockResolvedValue(null)
    lockFamilyForPaymentMock.mockResolvedValue(true)
  })

  it("refuses an event signed by another school's secret", async () => {
    expect(await completeCheckoutSession({ ...input, schoolId: 'school-2' })).toBe('notFound')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('records an event verified by the school owning the transaction', async () => {
    expect(await completeCheckoutSession({ ...input, schoolId: 'school-1' })).toBe('OK')
  })

  it('creates allocations and marks the transaction succeeded atomically', async () => {
    expect(await completeCheckoutSession(input)).toBe('OK')

    expect(findPaymentTransactionByProviderSessionIdMock).toHaveBeenCalledWith('cs_1')
    expect(lockFamilyForPaymentMock).toHaveBeenCalledWith(txMock, 'school-1', 'family-1')
    expect(getFamilyBalanceMock).toHaveBeenCalledWith('school-1', 'family-1', txMock)
    expect(lockFamilyForPaymentMock.mock.invocationCallOrder[0]).toBeLessThan(
      getFamilyBalanceMock.mock.invocationCallOrder[0]
    )
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
    expect(txMock.paymentTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'transaction-1', schoolId: 'school-1', status: { not: 'SUCCEEDED' } },
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

  it('records the full Stripe capture even when a manual payment shrank the balance since checkout (#306)', async () => {
    getFamilyBalanceMock.mockResolvedValue({
      payableEnrollments: [
        { enrollmentId: 'enrollment-1', totalAmount: 60, discount: 0, remainingBalance: 20 },
        { enrollmentId: 'enrollment-2', totalAmount: 40, discount: 0, remainingBalance: 0 },
      ],
    })

    expect(await completeCheckoutSession(input)).toBe('OK')

    expect(txMock.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ enrollmentId: 'enrollment-1', amount: 100 }),
        expect.objectContaining({ enrollmentId: 'enrollment-2', amount: 0 }),
      ],
    })
    expect(txMock.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) })
    )
  })

  it('records the capture when a second paid session exceeds a balance already settled', async () => {
    // Deux sessions ouvertes pour le même solde : la première a tout soldé, la seconde arrive.
    getFamilyBalanceMock.mockResolvedValue({
      payableEnrollments: [
        { enrollmentId: 'enrollment-1', totalAmount: 60, discount: 0, remainingBalance: 0 },
        { enrollmentId: 'enrollment-2', totalAmount: 40, discount: 0, remainingBalance: 0 },
      ],
    })

    expect(await completeCheckoutSession(input)).toBe('OK')

    expect(txMock.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ enrollmentId: 'enrollment-1', amount: 100, method: 'STRIPE' }),
        expect.objectContaining({ enrollmentId: 'enrollment-2', amount: 0 }),
      ],
    })
    expect(txMock.paymentProviderEvent.create).toHaveBeenCalled()
  })

  it('records the capture on the latest family enrollment when none is payable anymore', async () => {
    getFamilyBalanceMock.mockResolvedValue({ payableEnrollments: [] })
    findLatestFamilyEnrollmentIdMock.mockResolvedValue('enrollment-cancelled')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await completeCheckoutSession(input)).toBe('OK')

    expect(findLatestFamilyEnrollmentIdMock).toHaveBeenCalledWith('school-1', 'family-1', txMock)
    expect(txMock.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          enrollmentId: 'enrollment-cancelled',
          amount: 100,
          paymentTransactionId: 'transaction-1',
        }),
      ],
    })
    expect(txMock.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) })
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[payments/complete-checkout-session] stripe payment recorded on a non-payable enrollment',
      expect.objectContaining({ enrollmentId: 'enrollment-cancelled' })
    )
    errorSpy.mockRestore()
  })

  it('still closes the transaction and alerts when the family has no enrollment at all', async () => {
    getFamilyBalanceMock.mockResolvedValue({ payableEnrollments: [] })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await completeCheckoutSession(input)).toBe('unallocated')

    expect(txMock.payment.createMany).not.toHaveBeenCalled()
    expect(txMock.paymentProviderEvent.create).toHaveBeenCalled()
    expect(txMock.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCEEDED', providerPaymentId: 'pi_1' }),
      })
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[payments/complete-checkout-session] stripe payment captured without any enrollment to allocate',
      expect.objectContaining({ transactionId: 'transaction-1' })
    )
    errorSpy.mockRestore()
  })

  it('still records the capture when the family was archived during checkout', async () => {
    lockFamilyForPaymentMock.mockResolvedValue(false)

    expect(await completeCheckoutSession(input)).toBe('OK')
    expect(txMock.payment.createMany).toHaveBeenCalledOnce()
  })

  it('treats a replayed event as a duplicate once the first one was recorded', async () => {
    expect(await completeCheckoutSession(input)).toBe('OK')

    dbMock.paymentProviderEvent.findUnique.mockResolvedValue({ id: 'provider-event-1' })
    findPaymentTransactionByProviderSessionIdMock.mockResolvedValue({
      ...transaction,
      status: 'SUCCEEDED',
    })

    expect(await completeCheckoutSession(input)).toBe('duplicate')
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rolls back a second event for the same session recorded concurrently', async () => {
    txMock.paymentTransaction.updateMany.mockResolvedValue({ count: 0 })

    expect(
      await completeCheckoutSession({
        ...input,
        providerEventId: 'evt_2',
        eventType: 'checkout.session.async_payment_succeeded',
      })
    ).toBe('duplicate')
  })

  it('reports a concurrent insert of the same provider event as a duplicate', async () => {
    dbMock.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))

    expect(await completeCheckoutSession(input)).toBe('duplicate')
  })
})
