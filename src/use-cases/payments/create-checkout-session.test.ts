import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  paymentTransaction: {
    create: vi.fn(),
    update: vi.fn(),
  },
}
const sessionsCreateMock = vi.fn()
const getStripeClientMock = vi.fn()
const getFamilyBalanceMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/stripe', () => ({ getStripeClient: getStripeClientMock }))
vi.mock('./family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))

const { createCheckoutSession } = await import('./create-checkout-session')

const schoolId = 'school-1'
const input = {
  schoolId,
  familyId: 'family-1',
  initiatedById: 'user-1',
  customerEmail: 'parent@example.com',
  locale: 'fr',
  appUrl: 'http://localhost:8550',
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
    getStripeClientMock.mockReturnValue({
      checkout: { sessions: { create: sessionsCreateMock } },
    })
    getFamilyBalanceMock.mockResolvedValue({
      remainingBalance: 120,
      remainingAmountInCents: 12000,
    })
    dbMock.paymentTransaction.create.mockResolvedValue({ id: 'transaction-1' })
    dbMock.paymentTransaction.update.mockResolvedValue({})
    sessionsCreateMock.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/session',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a controlled error when Stripe is not configured', async () => {
    getStripeClientMock.mockReturnValue(null)

    expect(await createCheckoutSession(input)).toBe('notConfigured')
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it('does not create a checkout without an outstanding balance', async () => {
    getFamilyBalanceMock.mockResolvedValue({
      remainingBalance: 0,
      remainingAmountInCents: 0,
    })

    expect(await createCheckoutSession(input)).toBe('noBalance')
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it('prices the checkout on the cumulated family balance', async () => {
    await createCheckoutSession(input)

    expect(getFamilyBalanceMock).toHaveBeenCalledWith(schoolId, 'family-1')
  })

  it('creates a server-priced checkout tied to the local transaction', async () => {
    const result = await createCheckoutSession(input)

    expect(result).toEqual({
      result: 'OK',
      url: 'https://checkout.stripe.test/session',
    })
    expect(dbMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId,
        familyId: 'family-1',
      }),
    })
    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'parent@example.com',
        client_reference_id: 'transaction-1',
        metadata: {
          transactionId: 'transaction-1',
          familyId: 'family-1',
        },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'eur',
              unit_amount: 12000,
            }),
          }),
        ],
      }),
      { idempotencyKey: 'transaction-1' }
    )
    expect(dbMock.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'transaction-1', schoolId } },
      data: { providerSessionId: 'cs_test_1' },
    })
  })

  it('marks the transaction failed when Stripe rejects the request', async () => {
    sessionsCreateMock.mockRejectedValue(new Error('Stripe unavailable'))

    expect(await createCheckoutSession(input)).toBe('providerError')
    expect(dbMock.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'transaction-1', schoolId } },
      data: { status: 'FAILED' },
    })
  })
})
