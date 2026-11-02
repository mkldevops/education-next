import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  mealServiceSetting: { findMany: vi.fn() },
  mealPrice: { findMany: vi.fn() },
}
const requireSchoolAdminMock = vi.fn()
const isMealsEnabledMock = vi.fn()
const staffMealGatewayMock = {
  listActive: vi.fn().mockResolvedValue([]),
  listActiveTeachers: vi.fn().mockResolvedValue([]),
}
const dailyMealHeadcountMock = vi.fn()

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
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: isMealsEnabledMock }))
vi.mock('@/gateways/staff-meal-gateway', () => ({ staffMealGateway: staffMealGatewayMock }))
vi.mock('@/use-cases/meals/daily-meal-headcount', () => ({
  dailyMealHeadcount: dailyMealHeadcountMock,
}))
vi.mock('../../_lib/auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('../../_lib/meal-actions', () => ({}))

const { default: MealsPage } = await import('./page')

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-1', userId: 'user-1' })
})

describe('MealsPage', () => {
  it('opens on notFound for a school that has not opted in, before any meal read', async () => {
    isMealsEnabledMock.mockResolvedValue(false)

    await expect(MealsPage({ params: Promise.resolve({ locale: 'fr' }) })).rejects.toThrow(
      'notFound'
    )

    expect(isMealsEnabledMock).toHaveBeenCalledWith('school-1')
    expect(dbMock.mealServiceSetting.findMany).not.toHaveBeenCalled()
    expect(dbMock.mealPrice.findMany).not.toHaveBeenCalled()
    expect(staffMealGatewayMock.listActive).not.toHaveBeenCalled()
    expect(dailyMealHeadcountMock).not.toHaveBeenCalled()
  })

  it('reads settings and prices scoped to the school once opted in', async () => {
    isMealsEnabledMock.mockResolvedValue(true)
    dbMock.mealServiceSetting.findMany.mockResolvedValue([])
    dbMock.mealPrice.findMany.mockResolvedValue([])
    dailyMealHeadcountMock.mockResolvedValue('mealsDisabled')

    await MealsPage({ params: Promise.resolve({ locale: 'fr' }) })

    expect(dbMock.mealServiceSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 'school-1' } })
    )
    expect(dbMock.mealPrice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 'school-1' } })
    )
    expect(staffMealGatewayMock.listActive).toHaveBeenCalledWith('school-1')
    expect(staffMealGatewayMock.listActiveTeachers).toHaveBeenCalledWith('school-1')
    expect(dailyMealHeadcountMock).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1' })
    )
  })
})
