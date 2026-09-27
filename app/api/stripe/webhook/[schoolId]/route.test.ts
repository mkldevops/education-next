import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructEventMock = vi.fn()
const getStripeClientMock = vi.fn()
const completeCheckoutSessionMock = vi.fn()
const resolveStripeCredentialsMock = vi.fn()

vi.mock('@/lib/stripe', () => ({ getStripeClient: getStripeClientMock }))
vi.mock('@/use-cases/payments/complete-checkout-session', () => ({
  completeCheckoutSession: completeCheckoutSessionMock,
}))
vi.mock('@/use-cases/payments/stripe-settings', () => ({
  resolveStripeCredentials: resolveStripeCredentialsMock,
}))

const { POST } = await import('./route')

const schoolId = '0b4f8c1e-6a0f-4c47-9d0e-2f7b3a1c5d9e'

function post(id = schoolId) {
  const request = new Request(`http://localhost/api/stripe/webhook/${id}`, {
    method: 'POST',
    headers: { 'stripe-signature': 'signature' },
    body: '{"id":"evt_1"}',
  })
  return POST(request, { params: Promise.resolve({ schoolId: id }) })
}

describe('Stripe webhook route per school', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveStripeCredentialsMock.mockResolvedValue({
      secretKey: 'sk_test_school',
      webhookSecret: 'whsec_school',
    })
    getStripeClientMock.mockReturnValue({ webhooks: { constructEvent: constructEventMock } })
    constructEventMock.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } },
    })
    completeCheckoutSessionMock.mockResolvedValue('OK')
  })

  it("verifies the signature with the school's own webhook secret", async () => {
    const response = await post()

    expect(response.status).toBe(200)
    expect(resolveStripeCredentialsMock).toHaveBeenCalledWith(schoolId)
    expect(getStripeClientMock).toHaveBeenCalledWith('sk_test_school')
    expect(constructEventMock).toHaveBeenCalledWith('{"id":"evt_1"}', 'signature', 'whsec_school')
  })

  it('only lets the verified school close its own transaction', async () => {
    await post()

    expect(completeCheckoutSessionMock).toHaveBeenCalledWith({
      providerEventId: 'evt_1',
      eventType: 'checkout.session.completed',
      session: { id: 'cs_1' },
      schoolId,
    })
  })

  it('refuses a school without Stripe credentials', async () => {
    resolveStripeCredentialsMock.mockResolvedValue(null)

    const response = await post()

    expect(response.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(completeCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it('refuses a malformed school id before any lookup', async () => {
    const response = await post('not-a-school')

    expect(response.status).toBe(400)
    expect(resolveStripeCredentialsMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid signature', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const response = await post()

    expect(response.status).toBe(400)
    expect(completeCheckoutSessionMock).not.toHaveBeenCalled()
  })
})
