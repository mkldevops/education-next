import { describe, expect, it, vi } from 'vitest'

const dbMock = { classPeriod: { findMany: vi.fn() } }
const getPaymentStatsMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/payments/payment-stats', () => ({ getPaymentStats: getPaymentStatsMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getSchoolInsights } = await import('./school-insights')

describe('getSchoolInsights', () => {
  it('skips the payment stats read when payments are disabled', async () => {
    dbMock.classPeriod.findMany.mockResolvedValue([])

    const insights = await getSchoolInsights('school-1', null, false)

    expect(getPaymentStatsMock).not.toHaveBeenCalled()
    expect(insights.payments).toBeNull()
  })

  it('reads payment stats when payments are enabled', async () => {
    dbMock.classPeriod.findMany.mockResolvedValue([])
    getPaymentStatsMock.mockResolvedValue({
      totals: {
        due: 0,
        collected: 0,
        remaining: 0,
        collectionRate: 0,
        enrollmentCount: 0,
        settledCount: 0,
        outstandingCount: 0,
        paymentCount: 0,
        uncashedAmount: 0,
        uncashedCount: 0,
      },
      monthly: [],
      methods: [],
      families: [],
    })

    const insights = await getSchoolInsights('school-1', null, true)

    expect(getPaymentStatsMock).toHaveBeenCalledWith('school-1', null)
    expect(insights.payments).not.toBeNull()
  })
})
