import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolCashierMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()
const searchMock = vi.fn()
const loadFamilyMock = vi.fn()
const getFamilyBalanceMock = vi.fn()
const loadReceiptMock = vi.fn()
const loadCashDayMock = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' }),
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
// Le baril `@peaklab/ui` tire `@/i18n/routing`, qui charge `next-intl/navigation` — non résolu
// par Node hors du bundler Next.
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: async () => true }))
vi.mock('@/use-cases/payments/family-balance', () => ({ getFamilyBalance: getFamilyBalanceMock }))
vi.mock('@/use-cases/payments/payable-enrollment-choices', () => ({
  listPayableEnrollmentChoices: async () => [],
}))
vi.mock('../../_lib/auth-helper', () => ({ requireSchoolCashier: requireSchoolCashierMock }))
vi.mock('./_lib/cashier-data', () => ({
  searchCashierFamilies: searchMock,
  loadCashierFamily: loadFamilyMock,
  loadCashierReceipt: loadReceiptMock,
}))
vi.mock('./_lib/cash-day-data', () => ({ loadCashDay: loadCashDayMock }))
vi.mock('./_components/cashier-search', () => ({ CashierSearch: () => null }))
vi.mock('./_components/cashier-form', () => ({ CashierForm: () => null }))

const { default: CashierPage } = await import('./page')

const FAMILY_ID = '7b0c8d1e-2f3a-4b5c-8d6e-9f0a1b2c3d4e'
const render = (searchParams: { q?: string; familyId?: string; receipt?: string }) =>
  CashierPage({
    params: Promise.resolve({ locale: 'fr' }),
    searchParams: Promise.resolve(searchParams),
  })

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolCashierMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
  isPaymentsEnabledMock.mockResolvedValue(true)
  searchMock.mockResolvedValue([])
  loadFamilyMock.mockResolvedValue({ id: FAMILY_ID, name: 'Saïd', students: [], lines: [] })
  getFamilyBalanceMock.mockResolvedValue({ remainingBalance: 1500 })
  loadReceiptMock.mockResolvedValue(null)
  loadCashDayMock.mockResolvedValue({
    net: { count: 0, total: 0, byMethod: {} },
    issuedRows: [],
  })
})

describe('CashierPage', () => {
  it('answers notFound when the cashier guard refuses, before any read', async () => {
    requireSchoolCashierMock.mockRejectedValue(new Error('notFound'))

    await expect(render({ q: 'Saïd' })).rejects.toThrow('notFound')

    expect(searchMock).not.toHaveBeenCalled()
    expect(loadFamilyMock).not.toHaveBeenCalled()
  })

  it('searches the school once the query has two characters', async () => {
    await render({ q: 'S' })
    expect(searchMock).not.toHaveBeenCalled()

    await render({ q: ' Saïd ' })
    expect(searchMock).toHaveBeenCalledWith('school-1', 'Saïd')
  })

  it('ignores a family id that is not a uuid', async () => {
    await render({ familyId: "x' OR 1=1" })

    expect(loadFamilyMock).not.toHaveBeenCalled()
  })

  it('ignores a receipt id that is not a uuid', async () => {
    await render({ receipt: "x' OR 1=1" })
    expect(loadReceiptMock).not.toHaveBeenCalled()

    await render({ receipt: FAMILY_ID })
    expect(loadReceiptMock).toHaveBeenCalledWith('school-1', FAMILY_ID)
  })

  it('loads the family and its tuition balance within the school', async () => {
    await render({ familyId: FAMILY_ID })

    expect(loadFamilyMock).toHaveBeenCalledWith('school-1', FAMILY_ID, expect.any(String))
    expect(getFamilyBalanceMock).toHaveBeenCalledWith('school-1', FAMILY_ID)
  })

  it('skips the tuition balance when the school does not take tuition', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    await render({ familyId: FAMILY_ID })

    expect(getFamilyBalanceMock).not.toHaveBeenCalled()
  })
})
