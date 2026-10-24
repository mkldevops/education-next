import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn(async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })),
}))

const { removeMealPrice } = await import('./remove-meal-price')

type MealGw = Parameters<typeof removeMealPrice>[1]
type ConfigGw = Parameters<typeof removeMealPrice>[2]

const schoolId = 'school-a'
const id = '123e4567-e89b-12d3-a456-426614174000'
const NOW = new Date('2026-10-25T22:30:00.000Z')

function setup(effectiveFrom: string | null, flag = 'true') {
  const mealGw = {
    findPrice: vi
      .fn()
      .mockResolvedValue(
        effectiveFrom === null ? null : { id, effectiveFrom: new Date(`${effectiveFrom}T00:00Z`) }
      ),
    deletePrice: vi.fn().mockResolvedValue({}),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: flag }) }
  const run = () =>
    removeMealPrice(
      { schoolId, id },
      mealGw as unknown as MealGw,
      configGw as unknown as ConfigGw,
      NOW
    )
  return { mealGw, run }
}

describe('removeMealPrice', () => {
  it('removes a price that is not effective yet', async () => {
    const { mealGw, run } = setup('2026-10-27')

    expect(await run()).toBe('OK')
    expect(mealGw.deletePrice).toHaveBeenCalledWith(schoolId, id)
  })

  it('keeps a price already effective in the school time zone', async () => {
    const { mealGw, run } = setup('2026-10-26')

    expect(await run()).toBe('alreadyEffective')
    expect(mealGw.deletePrice).not.toHaveBeenCalled()
  })

  it('reports a price of another school as not found', async () => {
    const { run } = setup(null)

    expect(await run()).toBe('notFound')
  })

  it('refuses while the school has not opted in', async () => {
    const { mealGw, run } = setup('2026-10-27', 'false')

    expect(await run()).toBe('mealsDisabled')
    expect(mealGw.deletePrice).not.toHaveBeenCalled()
  })
})
