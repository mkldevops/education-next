import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isMealsEnabled } = vi.hoisted(() => ({ isMealsEnabled: vi.fn() }))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled }))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn().mockResolvedValue({ timeZone: 'Indian/Comoro' }),
}))
vi.mock('@/lib/db', () => ({ db: {} }))

const { listMealDebtorsFromMcp } = await import('./meal-reads')

const scope = {
  schoolId: 'school-a',
  userId: 'admin-a',
  paymentsEnabled: true,
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'admin-a' },
}

function row(service: 'CANTEEN' | 'SNACK', dueAmount: number) {
  return {
    studentId: `student-${service}`,
    name: 'NEYMA ALI BACARI',
    familyId: 'family-1',
    service,
    paidThrough: '2026-11-06',
    dueDays: dueAmount / 500,
    dueAmount,
    coveredLeft: 0,
    phone: null,
  }
}

const loadDebtors = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  isMealsEnabled.mockResolvedValue(true)
  loadDebtors.mockResolvedValue([row('CANTEEN', 2250), row('SNACK', 1000)])
})

describe('listMealDebtorsFromMcp', () => {
  it('lists every meal debtor of the caller school with the total due', async () => {
    const result = await listMealDebtorsFromMcp(scope, {}, loadDebtors)

    expect(loadDebtors).toHaveBeenCalledWith('school-a', expect.stringMatching(/^\d{4}-\d\d-\d\d$/))
    expect(result).toMatchObject({ count: 2, dueAmount: 3250 })
  })

  it('keeps only the requested service', async () => {
    const result = await listMealDebtorsFromMcp(scope, { service: 'SNACK' }, loadDebtors)

    expect(result).toMatchObject({ count: 1, dueAmount: 1000, debtors: [{ service: 'SNACK' }] })
  })

  it('refuses when meals are off or the service is unknown', async () => {
    isMealsEnabled.mockResolvedValue(false)
    expect(await listMealDebtorsFromMcp(scope, {}, loadDebtors)).toBe('mealsDisabled')
    expect(await listMealDebtorsFromMcp(scope, { service: 'LUNCH' } as never, loadDebtors)).toBe(
      'validationError'
    )
    expect(loadDebtors).not.toHaveBeenCalled()
  })
})
