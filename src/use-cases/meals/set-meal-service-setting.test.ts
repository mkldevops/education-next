import { describe, expect, it, vi } from 'vitest'
import { setMealServiceSetting } from './set-meal-service-setting'

type MealGw = Parameters<typeof setMealServiceSetting>[1]
type ConfigGw = Parameters<typeof setMealServiceSetting>[2]

const schoolId = 'school-a'

function setup(flag: string | null = 'true') {
  const mealGw = { upsertSetting: vi.fn().mockResolvedValue({}) }
  const configGw = { get: vi.fn().mockResolvedValue(flag === null ? null : { value: flag }) }
  const run = (input: Partial<Parameters<typeof setMealServiceSetting>[0]> = {}) =>
    setMealServiceSetting(
      { schoolId, service: 'CANTEEN', isEnabled: true, allowedWeekdays: [4, 1, 2, 3], ...input },
      mealGw as unknown as MealGw,
      configGw as unknown as ConfigGw
    )
  return { mealGw, run }
}

describe('setMealServiceSetting', () => {
  it('stores the sorted weekdays of the school', async () => {
    const { mealGw, run } = setup()

    expect(await run()).toBe('OK')
    expect(mealGw.upsertSetting).toHaveBeenCalledWith(schoolId, 'CANTEEN', {
      isEnabled: true,
      allowedWeekdays: [1, 2, 3, 4],
    })
  })

  it('refuses while the school has not opted in', async () => {
    const { mealGw, run } = setup(null)

    expect(await run()).toBe('mealsDisabled')
    expect(mealGw.upsertSetting).not.toHaveBeenCalled()
  })

  it('refuses empty, duplicated or out-of-range weekdays', async () => {
    const { mealGw, run } = setup()

    expect(await run({ allowedWeekdays: [] })).toBe('invalidWeekdays')
    expect(await run({ allowedWeekdays: [1, 1] })).toBe('invalidWeekdays')
    expect(await run({ allowedWeekdays: [8] })).toBe('invalidWeekdays')
    expect(mealGw.upsertSetting).not.toHaveBeenCalled()
  })

  it('refuses an unknown service', async () => {
    const { run } = setup()

    expect(await run({ service: 'BREAKFAST' as never })).toBe('validationError')
  })
})
