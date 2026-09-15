import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  payment: { findMany: vi.fn() },
}
const requireSchoolScopeMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const getSelectedPeriodMock = vi.fn()
const getPaymentStatsMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
// `@/i18n/routing` charge `next-intl/navigation`, que Node ne résout pas hors du bundler
// Next : la navigation localisée est simulée, `redirect` n'est jamais atteint dans ces tests.
vi.mock('@/i18n/routing', () => ({
  redirect: () => {
    throw new Error('redirect')
  },
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('@/use-cases/payments/payment-stats', () => ({ getPaymentStats: getPaymentStatsMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('../../_lib/auth-helper', () => ({ requireSchoolScope: requireSchoolScopeMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: PaymentsPage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolScopeMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
})

describe('PaymentsPage', () => {
  it('opens on notFound when payments are disabled, before any business read', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    await expect(PaymentsPage({ params: Promise.resolve({ locale: 'fr' }) })).rejects.toThrow(
      'notFound'
    )

    expect(isPaymentsEnabledMock).toHaveBeenCalledWith('school-1')
    expect(getSelectedPeriodMock).not.toHaveBeenCalled()
    expect(dbMock.payment.findMany).not.toHaveBeenCalled()
    expect(getPaymentStatsMock).not.toHaveBeenCalled()
  })

  it('proceeds past the flag guard and reads business data when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getSelectedPeriodMock.mockResolvedValue(null)
    dbMock.payment.findMany.mockResolvedValue([])
    getPaymentStatsMock.mockResolvedValue({
      totals: { collected: 0, remaining: 0, collectionRate: 0 },
      monthly: [],
      methods: [],
      families: [],
    })

    await PaymentsPage({ params: Promise.resolve({ locale: 'fr' }) })

    expect(getSelectedPeriodMock).toHaveBeenCalledWith('school-1')
    expect(dbMock.payment.findMany).toHaveBeenCalled()
  })
})
