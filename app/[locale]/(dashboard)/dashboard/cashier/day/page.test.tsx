import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolCashierMock = vi.fn()
const loadCashDayMock = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' }),
}))
vi.mock('@/domain/school-date', () => ({ schoolToday: () => '2026-10-24' }))
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
vi.mock('../../../_lib/auth-helper', () => ({ requireSchoolCashier: requireSchoolCashierMock }))
vi.mock('../_lib/cash-day-data', () => ({ loadCashDay: loadCashDayMock }))

const { default: CashDayPage } = await import('./page')

const render = (day?: string) =>
  CashDayPage({
    params: Promise.resolve({ locale: 'fr' }),
    searchParams: Promise.resolve({ day }),
  })

const totals = {
  count: 0,
  total: 0,
  byMethod: {},
  byLine: { CANTEEN: 0, SNACK: 0, CHILDCARE: 0, TUITION: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolCashierMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
  loadCashDayMock.mockResolvedValue({
    issued: totals,
    cancelled: totals,
    net: totals,
    issuedRows: [],
    cancelledRows: [],
  })
})

describe('CashDayPage', () => {
  it('answers notFound when the cashier guard refuses, before any read', async () => {
    requireSchoolCashierMock.mockRejectedValue(new Error('notFound'))

    await expect(render()).rejects.toThrow('notFound')
    expect(loadCashDayMock).not.toHaveBeenCalled()
  })

  it("opens on the school's today", async () => {
    await render()

    expect(loadCashDayMock).toHaveBeenCalledWith('school-1', '2026-10-24', 'Indian/Comoro')
  })

  it('reads a past day', async () => {
    await render('2026-10-20')

    expect(loadCashDayMock).toHaveBeenCalledWith('school-1', '2026-10-20', 'Indian/Comoro')
  })

  it('falls back to today for a malformed or future day', async () => {
    await render('2026-13-45')
    await render('2026-10-25')

    expect(loadCashDayMock).toHaveBeenNthCalledWith(1, 'school-1', '2026-10-24', 'Indian/Comoro')
    expect(loadCashDayMock).toHaveBeenNthCalledWith(2, 'school-1', '2026-10-24', 'Indian/Comoro')
  })
})
