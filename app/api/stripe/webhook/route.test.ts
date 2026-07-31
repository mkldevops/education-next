import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const constructEventMock = vi.fn()
const getStripeClientMock = vi.fn()
const completeCheckoutSessionMock = vi.fn()

vi.mock('@/lib/stripe', () => ({ getStripeClient: getStripeClientMock }))
vi.mock('@/use-cases/payments/complete-checkout-session', () => ({
  completeCheckoutSession: completeCheckoutSessionMock,
}))

const { POST } = await import('./route')

function createRequest(signature = 'signature') {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: '{"id":"evt_1"}',
  })
}

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
    getStripeClientMock.mockReturnValue({
      webhooks: { constructEvent: constructEventMock },
    })
    constructEventMock.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } },
    })
    completeCheckoutSessionMock.mockResolvedValue('OK')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects an invalid signature', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const response = await POST(createRequest())

    expect(response.status).toBe(400)
    expect(completeCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it('dispatches a verified completed checkout', async () => {
    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(completeCheckoutSessionMock).toHaveBeenCalledWith({
      providerEventId: 'evt_1',
      eventType: 'checkout.session.completed',
      session: { id: 'cs_1' },
    })
  })

  it('acknowledges unrelated Stripe events without processing them', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_2',
      type: 'customer.created',
      data: { object: {} },
    })

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(completeCheckoutSessionMock).not.toHaveBeenCalled()
  })
})
