import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolCashierMock = vi.fn()
const loadMealDebtorsMock = vi.fn()

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
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('../../../_lib/auth-helper', () => ({ requireSchoolCashier: requireSchoolCashierMock }))
vi.mock('../_lib/debtors-data', () => ({
  loadMealDebtors: loadMealDebtorsMock,
  REMIND_WITHIN_DAYS: 2,
}))

const { default: MealDebtorsPage } = await import('./page')

const render = () => MealDebtorsPage({ params: Promise.resolve({ locale: 'fr' }) })

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolCashierMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isAdmin: true,
  })
  loadMealDebtorsMock.mockResolvedValue([])
})

describe('MealDebtorsPage', () => {
  it('answers notFound when the cashier guard refuses, before any read', async () => {
    requireSchoolCashierMock.mockRejectedValue(new Error('notFound'))

    await expect(render()).rejects.toThrow('notFound')
    expect(loadMealDebtorsMock).not.toHaveBeenCalled()
  })

  it('links each row to the student and to the cashier of the debtor family', async () => {
    loadMealDebtorsMock.mockResolvedValue([
      {
        studentId: 'student-1',
        name: 'Léo Martin',
        familyId: 'family-1',
        service: 'CANTEEN',
        paidThrough: '2026-10-20',
        dueDays: 3,
        dueAmount: 1500,
        coveredLeft: 0,
      },
    ])

    const html = renderToStaticMarkup(await render())

    expect(loadMealDebtorsMock).toHaveBeenCalledWith('school-1', '2026-10-24')
    expect(html).toContain('href="/dashboard/cashier/students/student-1"')
    expect(html).toContain('href="/dashboard/cashier?familyId=family-1"')
  })
})
