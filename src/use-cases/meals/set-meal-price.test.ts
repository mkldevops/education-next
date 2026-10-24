import { beforeEach, describe, expect, it, vi } from 'vitest'

const regional = vi.hoisted(() => ({ currency: 'KMF', timeZone: 'Indian/Comoro' }))

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn(async () => regional),
}))

const { setMealPrice } = await import('./set-meal-price')

type MealGw = Parameters<typeof setMealPrice>[1]
type ConfigGw = Parameters<typeof setMealPrice>[2]

const schoolId = 'school-a'
// 22 h 30 UTC le 25 octobre : déjà le 26 à Moroni.
const NOW = new Date('2026-10-25T22:30:00.000Z')

function setup({ prices = 1, flag = 'true' }: { prices?: number; flag?: string | null } = {}) {
  const mealGw = {
    countPrices: vi.fn().mockResolvedValue(prices),
    upsertPrice: vi.fn().mockResolvedValue({}),
  }
  const configGw = { get: vi.fn().mockResolvedValue(flag === null ? null : { value: flag }) }
  const run = (input: Partial<Parameters<typeof setMealPrice>[0]> = {}) =>
    setMealPrice(
      { schoolId, service: 'CANTEEN', amount: 1000, effectiveFrom: '2026-10-26', ...input },
      mealGw as unknown as MealGw,
      configGw as unknown as ConfigGw,
      NOW
    )
  return { mealGw, run }
}

describe('setMealPrice', () => {
  beforeEach(() => {
    regional.currency = 'KMF'
  })

  it('records a price effective from today in the school time zone', async () => {
    const { mealGw, run } = setup()

    expect(await run()).toBe('OK')
    expect(mealGw.upsertPrice).toHaveBeenCalledWith(schoolId, 'CANTEEN', 1000, '2026-10-26')
  })

  it('refuses a backdated price once the service has one', async () => {
    const { mealGw, run } = setup()

    expect(await run({ effectiveFrom: '2026-10-25' })).toBe('backdated')
    expect(mealGw.upsertPrice).not.toHaveBeenCalled()
  })

  it('lets the first price start at the beginning of the year', async () => {
    const { run } = setup({ prices: 0 })

    expect(await run({ effectiveFrom: '2026-09-01' })).toBe('OK')
  })

  it('refuses decimals the currency does not have, and non-positive amounts', async () => {
    const { mealGw, run } = setup()

    expect(await run({ amount: 750.5 })).toBe('validationError')
    expect(await run({ amount: 0 })).toBe('validationError')
    expect(mealGw.upsertPrice).not.toHaveBeenCalled()

    regional.currency = 'EUR'
    expect(await run({ amount: 7.5 })).toBe('OK')
  })

  it('refuses while the school has not opted in', async () => {
    const { mealGw, run } = setup({ flag: 'false' })

    expect(await run()).toBe('mealsDisabled')
    expect(mealGw.upsertPrice).not.toHaveBeenCalled()
  })
})
