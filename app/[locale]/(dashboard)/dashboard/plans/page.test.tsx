import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  plan: { findMany: vi.fn() },
  enrollment: { groupBy: vi.fn() },
}
const requireSchoolAdminMock = vi.fn()
const isPaymentsEnabledMock = vi.fn()

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
// Le baril `@peaklab/ui` (`Breadcrumbs`, `DataTable`) tire `@/i18n/routing`, qui charge
// `next-intl/navigation` — non résolu par Node hors du bundler Next.
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('../../_lib/auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: PlansPage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    isSuperAdmin: false,
  })
})

describe('PlansPage', () => {
  it('opens on notFound when payments are disabled, before any business read', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    await expect(PlansPage({ params: Promise.resolve({ locale: 'fr' }) })).rejects.toThrow(
      'notFound'
    )

    expect(isPaymentsEnabledMock).toHaveBeenCalledWith('school-1')
    expect(dbMock.plan.findMany).not.toHaveBeenCalled()
    expect(dbMock.enrollment.groupBy).not.toHaveBeenCalled()
  })

  it('proceeds past the flag guard and reads business data when payments are enabled', async () => {
    isPaymentsEnabledMock.mockResolvedValue(true)
    dbMock.plan.findMany.mockResolvedValue([])
    dbMock.enrollment.groupBy.mockResolvedValue([])

    await PlansPage({ params: Promise.resolve({ locale: 'fr' }) })

    expect(dbMock.plan.findMany).toHaveBeenCalled()
  })
})
