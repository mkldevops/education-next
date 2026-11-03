import { describe, expect, it, vi } from 'vitest'
import { setStaffMeal } from './set-staff-meal'

type StaffGw = Parameters<typeof setStaffMeal>[1]
type AccountGw = Parameters<typeof setStaffMeal>[2]
type ConfigGw = Parameters<typeof setStaffMeal>[3]

const schoolId = 'school-a'
const teacherId = '7f1c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f'

function setup({
  flag = 'true',
  setting = { isEnabled: true, allowedWeekdays: [1, 2, 3, 4] },
  activeTeacher = true,
}: {
  flag?: string | null
  setting?: { isEnabled: boolean; allowedWeekdays: number[] } | null
  activeTeacher?: boolean
} = {}) {
  const staffGw = {
    isActiveTeacher: vi.fn().mockResolvedValue(activeTeacher),
    upsert: vi.fn().mockResolvedValue({}),
  }
  const accountGw = { findSetting: vi.fn().mockResolvedValue(setting) }
  const configGw = { get: vi.fn().mockResolvedValue(flag === null ? null : { value: flag }) }
  const run = (input: Partial<Parameters<typeof setStaffMeal>[0]> = {}) =>
    setStaffMeal(
      { schoolId, teacherId, service: 'CANTEEN', weekdays: [4, 3], isFree: false, ...input },
      staffGw as unknown as StaffGw,
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { staffGw, run }
}

describe('setStaffMeal', () => {
  it('stores the sorted weekdays and the free flag', async () => {
    const { staffGw, run } = setup()

    expect(await run({ isFree: true })).toBe('OK')
    expect(staffGw.upsert).toHaveBeenCalledWith(schoolId, teacherId, 'CANTEEN', {
      weekdays: [3, 4],
      isFree: true,
    })
  })

  it('refuses while meals are off or the service is disabled', async () => {
    expect(await setup({ flag: null }).run()).toBe('mealsDisabled')
    expect(await setup({ setting: null }).run()).toBe('serviceDisabled')
    expect(
      await setup({ setting: { isEnabled: false, allowedWeekdays: [1, 2, 3, 4] } }).run()
    ).toBe('serviceDisabled')
  })

  it('refuses a day the school does not serve', async () => {
    const { staffGw, run } = setup()

    expect(await run({ weekdays: [5] })).toBe('invalidWeekdays')
    expect(await run({ weekdays: [] })).toBe('invalidWeekdays')
    expect(staffGw.upsert).not.toHaveBeenCalled()
  })

  it('refuses an unknown or inactive staff member', async () => {
    const { staffGw, run } = setup({ activeTeacher: false })

    expect(await run()).toBe('notFound')
    expect(staffGw.upsert).not.toHaveBeenCalled()
  })
})
