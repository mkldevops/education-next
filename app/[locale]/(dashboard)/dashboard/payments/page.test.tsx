import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolScopeMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const getSelectedPeriodMock = vi.fn()
const getPaymentStatsMock = vi.fn()
const listSchoolPaymentsMock = vi.fn()
const familyFindManyMock = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))
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
vi.mock('@/features/dashboard/period', () => ({ getSelectedPeriod: getSelectedPeriodMock }))
vi.mock('@/use-cases/payments/payment-stats', () => ({ getPaymentStats: getPaymentStatsMock }))
vi.mock('@/use-cases/payments/list-school-payments', () => ({
  listSchoolPayments: listSchoolPaymentsMock,
}))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/lib/db', () => ({ db: { family: { findMany: familyFindManyMock } } }))
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
    expect(listSchoolPaymentsMock).not.toHaveBeenCalled()
    expect(getPaymentStatsMock).not.toHaveBeenCalled()
    expect(familyFindManyMock).not.toHaveBeenCalled()
  })

  it('proceeds past the flag guard and reads business data when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    getSelectedPeriodMock.mockResolvedValue({ id: 'period-1', name: '2026-2027' })
    listSchoolPaymentsMock.mockResolvedValue([])
    familyFindManyMock.mockResolvedValue([])
    getPaymentStatsMock.mockResolvedValue({
      totals: { collected: 0, remaining: 0, collectionRate: 0 },
      monthly: [],
      methods: [],
      families: [],
    })

    await PaymentsPage({ params: Promise.resolve({ locale: 'fr' }) })

    expect(getSelectedPeriodMock).toHaveBeenCalledWith('school-1')
    expect(listSchoolPaymentsMock).toHaveBeenCalledWith('school-1', 'period-1')
    expect(getPaymentStatsMock).toHaveBeenCalledWith('school-1', 'period-1')
    // Le sélecteur du bouton « Enregistrer un règlement » ne liste que les familles actives
    // de l'école courante.
    expect(familyFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 'school-1', isActive: true } })
    )
  })
})
