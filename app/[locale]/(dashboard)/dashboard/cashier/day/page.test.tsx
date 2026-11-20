import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolCashDayMock = vi.fn()
const loadCashDayMock = vi.fn()
const loadUnreceiptedPaymentsMock = vi.fn()
const isMealsEnabledMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()

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
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: isMealsEnabledMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('../../../_lib/auth-helper', () => ({ requireSchoolCashDay: requireSchoolCashDayMock }))
vi.mock('../_lib/cash-day-data', () => ({
  loadCashDay: loadCashDayMock,
  loadUnreceiptedPayments: loadUnreceiptedPaymentsMock,
}))

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
  requireSchoolCashDayMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
  isMealsEnabledMock.mockResolvedValue(true)
  isPaymentsEnabledMock.mockResolvedValue(true)
  loadUnreceiptedPaymentsMock.mockResolvedValue({ rows: [], total: 0, truncated: false })
  loadCashDayMock.mockResolvedValue({
    issued: totals,
    cancelled: totals,
    net: totals,
    issuedRows: [],
    cancelledRows: [],
  })
})

describe('CashDayPage', () => {
  it('answers notFound when the day-view guard refuses, before any read', async () => {
    requireSchoolCashDayMock.mockRejectedValue(new Error('notFound'))

    await expect(render()).rejects.toThrow('notFound')
    expect(isMealsEnabledMock).not.toHaveBeenCalled()
    expect(isPaymentsEnabledMock).not.toHaveBeenCalled()
    expect(loadCashDayMock).not.toHaveBeenCalled()
    expect(loadUnreceiptedPaymentsMock).not.toHaveBeenCalled()
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

  it('keeps every line and the cashier link for a school with meals', async () => {
    const html = renderToStaticMarkup(await render())

    for (const line of ['CANTEEN', 'SNACK', 'CHILDCARE', 'TUITION']) {
      expect(html).toContain(`lines.${line}`)
    }
    expect(html).toContain('href="/dashboard/cashier"')
  })

  describe('in a tuition-only school', () => {
    beforeEach(() => {
      isMealsEnabledMock.mockResolvedValue(false)
      loadCashDayMock.mockResolvedValue({
        issued: { ...totals, count: 1, total: 15000, byLine: { ...totals.byLine, TUITION: 15000 } },
        cancelled: totals,
        net: { ...totals, count: 1, total: 15000, byLine: { ...totals.byLine, TUITION: 15000 } },
        issuedRows: [
          {
            id: 'receipt-1',
            number: 12,
            familyId: 'family-1',
            createdAt: new Date('2026-10-24T08:00:00.000Z'),
            family: 'Famille Saïd',
            total: 15000,
            method: 'CASH',
            cancelled: false,
          },
        ],
        cancelledRows: [],
      })
    })

    it("shows the day's tuition receipts with the tuition line alone", async () => {
      const html = renderToStaticMarkup(await render())

      expect(loadCashDayMock).toHaveBeenCalledWith('school-1', '2026-10-24', 'Indian/Comoro')
      expect(html).toContain('href="/dashboard/cashier/receipts/receipt-1?')
      expect(html).toContain('lines.TUITION')
      for (const line of ['CANTEEN', 'SNACK', 'CHILDCARE']) {
        expect(html).not.toContain(`lines.${line}`)
      }
    })

    it('does not link to the cashier, which stays closed', async () => {
      const html = renderToStaticMarkup(await render())

      expect(html).not.toContain('href="/dashboard/cashier"')
    })

    it('lists the payments without a receipt apart, refunds flagged', async () => {
      loadUnreceiptedPaymentsMock.mockResolvedValue({
        rows: [
          {
            id: 'pay-1',
            familyId: 'family-2',
            family: 'Famille Abdou',
            amount: 5000,
            method: 'CASH',
          },
          {
            id: 'pay-2',
            familyId: 'family-3',
            family: 'Famille Mze',
            amount: -2000,
            method: 'CASH',
          },
        ],
        total: 3000,
        truncated: false,
      })

      const html = renderToStaticMarkup(await render('2026-10-20'))

      expect(loadUnreceiptedPaymentsMock).toHaveBeenCalledWith(
        'school-1',
        '2026-10-20',
        'Indian/Comoro'
      )
      expect(html).toContain('unreceipted.title')
      expect(html).toContain('href="/dashboard/families/family-2?tab=payments"')
      expect(html).toContain('Famille Mze')
      expect(html.match(/unreceipted\.refund/g)).toHaveLength(1)
      expect(html).toContain('unreceipted.total')
      expect(html).not.toContain('unreceipted.truncated')
    })

    it('warns when the day holds more payments than the list reads', async () => {
      loadUnreceiptedPaymentsMock.mockResolvedValue({
        rows: [
          {
            id: 'pay-1',
            familyId: 'family-2',
            family: 'Famille Abdou',
            amount: 5000,
            method: 'CASH',
          },
        ],
        total: 5000,
        truncated: true,
      })

      const html = renderToStaticMarkup(await render())

      expect(html).toContain('unreceipted.truncated')
    })

    it('says so when every payment of the day has its receipt', async () => {
      const html = renderToStaticMarkup(await render())

      expect(html).toContain('unreceipted.none')
      expect(html).not.toContain('unreceipted.total')
    })
  })

  it('never reads tuition payments for a cashier', async () => {
    requireSchoolCashDayMock.mockResolvedValue({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
    })

    const html = renderToStaticMarkup(await render())

    expect(loadUnreceiptedPaymentsMock).not.toHaveBeenCalled()
    expect(html).not.toContain('unreceipted.title')
  })

  it('skips the section when the school does not collect payments', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    const html = renderToStaticMarkup(await render())

    expect(loadUnreceiptedPaymentsMock).not.toHaveBeenCalled()
    expect(html).not.toContain('unreceipted.title')
  })
})
