import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const txMock = {
  paymentTransaction: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}
const dbMock = {
  paymentTransaction: txMock.paymentTransaction,
  $transaction: vi.fn(),
}
const tryLockFamilyCheckoutMock = vi.fn()
const sessionsCreateMock = vi.fn()
const sessionsRetrieveMock = vi.fn()
const sessionsExpireMock = vi.fn()
const getStripeClientMock = vi.fn()
const getFamilyBalanceMock = vi.fn()
const resolveCheckoutCredentialsMock = vi.fn()
const isStripeCurrencyMock = vi.fn()
const configGatewayMock = {
  get: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/stripe', () => ({ getStripeClient: getStripeClientMock }))
vi.mock('./family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))
vi.mock('./stripe-settings', () => ({
  resolveCheckoutCredentials: resolveCheckoutCredentialsMock,
  isStripeCurrency: isStripeCurrencyMock,
  STRIPE_CURRENCY: 'EUR',
}))
vi.mock('@/gateways/config-gateway', () => ({ configGateway: configGatewayMock }))
vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { tryLockFamilyCheckout: tryLockFamilyCheckoutMock },
}))

const { createCheckoutSession } = await import('./create-checkout-session')

const schoolId = 'school-1'
const input = {
  schoolId,
  familyId: 'family-1',
  initiatedById: 'user-1',
  customerEmail: 'parent@example.com',
  locale: 'fr',
  productName: 'Frais de scolarité',
  appUrl: 'http://localhost:8550',
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isStripeCurrencyMock.mockResolvedValue(true)
    resolveCheckoutCredentialsMock.mockResolvedValue({
      secretKey: 'sk_test_school',
      webhookSecret: 'whsec_school',
    })
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: sessionsCreateMock,
          retrieve: sessionsRetrieveMock,
          expire: sessionsExpireMock,
        },
      },
    })
    getFamilyBalanceMock.mockResolvedValue({
      remainingBalance: 120,
      remainingAmountInCents: 12000,
    })
    dbMock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(txMock))
    tryLockFamilyCheckoutMock.mockResolvedValue(true)
    dbMock.paymentTransaction.create.mockResolvedValue({ id: 'transaction-1' })
    dbMock.paymentTransaction.update.mockResolvedValue({})
    dbMock.paymentTransaction.findMany.mockResolvedValue([])
    sessionsCreateMock.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/session',
    })
    configGatewayMock.get.mockResolvedValue({ value: 'true' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to create a checkout session when payments are disabled', async () => {
    configGatewayMock.get.mockResolvedValue({ value: 'false' })

    expect(await createCheckoutSession(input)).toBe('paymentsDisabled')
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it('refuses a school whose currency Checkout does not handle before opening anything', async () => {
    isStripeCurrencyMock.mockResolvedValue(false)

    expect(await createCheckoutSession(input)).toBe('notConfigured')
    expect(getStripeClientMock).not.toHaveBeenCalled()
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it('returns a controlled error when Stripe is disabled or not configured for the school', async () => {
    resolveCheckoutCredentialsMock.mockResolvedValue(null)

    expect(await createCheckoutSession(input)).toBe('notConfigured')
    expect(resolveCheckoutCredentialsMock).toHaveBeenCalledWith(schoolId, configGatewayMock)
    expect(getStripeClientMock).not.toHaveBeenCalled()
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it("opens the session with the school's own secret key", async () => {
    await createCheckoutSession(input)

    expect(getStripeClientMock).toHaveBeenCalledWith('sk_test_school')
  })

  it('does not create a checkout without an outstanding balance', async () => {
    getFamilyBalanceMock.mockResolvedValue({
      remainingBalance: 0,
      remainingAmountInCents: 0,
    })

    expect(await createCheckoutSession(input)).toBe('noBalance')
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it('reads the balance only under the family checkout lock', async () => {
    await createCheckoutSession(input)

    expect(tryLockFamilyCheckoutMock).toHaveBeenCalledWith(txMock, schoolId, 'family-1')
    expect(tryLockFamilyCheckoutMock.mock.invocationCallOrder[0]).toBeLessThan(
      getFamilyBalanceMock.mock.invocationCallOrder[0]
    )
  })

  it('opens nothing while another checkout of the family is being opened', async () => {
    tryLockFamilyCheckoutMock.mockResolvedValue(false)

    expect(await createCheckoutSession(input)).toBe('checkoutInProgress')
    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
    expect(sessionsCreateMock).not.toHaveBeenCalled()
  })

  it('prices the checkout on the cumulated family balance', async () => {
    await createCheckoutSession(input)

    expect(getFamilyBalanceMock).toHaveBeenCalledWith(schoolId, 'family-1', txMock)
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
          schoolId,
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

  it("labels the line item and the Checkout page in the parent's language", async () => {
    await createCheckoutSession({ ...input, locale: 'en', productName: 'Tuition fees' })

    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: { name: 'Tuition fees' },
            }),
          }),
        ],
        success_url: 'http://localhost:8550/en/dashboard/families/family-1?payment=success',
      }),
      expect.anything()
    )
  })

  it('lets Stripe detect the language when the locale is not one it supports', async () => {
    await createCheckoutSession({ ...input, locale: 'xx' })

    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'auto' }),
      expect.anything()
    )
  })

  it('expires the created session when the transaction cannot commit', async () => {
    dbMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      await callback(txMock)
      throw new Error('Transaction already closed')
    })

    await expect(createCheckoutSession(input)).rejects.toThrow('Transaction already closed')
    expect(sessionsExpireMock).toHaveBeenCalledWith('cs_test_1')
  })

  it('marks the transaction failed when Stripe rejects the request', async () => {
    sessionsCreateMock.mockRejectedValue(new Error('Stripe unavailable'))

    expect(await createCheckoutSession(input)).toBe('providerError')
    expect(dbMock.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'transaction-1', schoolId } },
      data: { status: 'FAILED' },
    })
  })

  describe('with an earlier pending checkout for the family', () => {
    beforeEach(() => {
      dbMock.paymentTransaction.findMany.mockResolvedValue([
        { id: 'transaction-0', providerSessionId: 'cs_old' },
      ])
    })

    it('expires the still open session before opening a new one', async () => {
      sessionsRetrieveMock.mockResolvedValue({ id: 'cs_old', status: 'open' })

      const result = await createCheckoutSession(input)

      expect(result).toEqual(expect.objectContaining({ result: 'OK' }))
      expect(dbMock.paymentTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schoolId, familyId: 'family-1', status: 'PENDING' }),
        })
      )
      expect(sessionsExpireMock).toHaveBeenCalledWith('cs_old')
      expect(dbMock.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id_schoolId: { id: 'transaction-0', schoolId } },
        data: { status: 'EXPIRED' },
      })
      expect(sessionsCreateMock).toHaveBeenCalled()
    })

    it('refuses a second session while a completed one awaits its webhook', async () => {
      sessionsRetrieveMock.mockResolvedValue({ id: 'cs_old', status: 'complete' })

      expect(await createCheckoutSession(input)).toBe('paymentInProgress')
      expect(sessionsExpireMock).not.toHaveBeenCalled()
      expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
      expect(sessionsCreateMock).not.toHaveBeenCalled()
    })

    it('expires a session unknown to the current Stripe account and opens a new one', async () => {
      sessionsRetrieveMock.mockRejectedValue(
        Object.assign(new Error('No such checkout.session'), { code: 'resource_missing' })
      )

      expect(await createCheckoutSession(input)).toEqual(expect.objectContaining({ result: 'OK' }))
      expect(sessionsExpireMock).not.toHaveBeenCalled()
      expect(dbMock.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id_schoolId: { id: 'transaction-0', schoolId } },
        data: { status: 'EXPIRED' },
      })
      expect(sessionsCreateMock).toHaveBeenCalled()
    })

    it('refuses a new session when Stripe cannot confirm the earlier one', async () => {
      sessionsRetrieveMock.mockRejectedValue(new Error('Stripe unavailable'))

      expect(await createCheckoutSession(input)).toBe('providerError')
      expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
    })

    it('does not open a new session when the earlier one cannot be closed', async () => {
      sessionsRetrieveMock.mockResolvedValue({ id: 'cs_old', status: 'open' })
      sessionsExpireMock.mockRejectedValue(new Error('session already completed'))

      expect(await createCheckoutSession(input)).toBe('providerError')
      expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled()
    })
  })
})
