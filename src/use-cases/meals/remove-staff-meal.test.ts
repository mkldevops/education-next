import { describe, expect, it, vi } from 'vitest'
import { removeStaffMeal } from './remove-staff-meal'

type StaffGw = Parameters<typeof removeStaffMeal>[1]
type ConfigGw = Parameters<typeof removeStaffMeal>[2]

const input = {
  schoolId: 'school-a',
  teacherId: '7f1c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
  service: 'CANTEEN' as const,
}

function setup(removed: number, flag: string | null = 'true') {
  const staffGw = { remove: vi.fn().mockResolvedValue(removed) }
  const configGw = { get: vi.fn().mockResolvedValue(flag === null ? null : { value: flag }) }
  const run = () =>
    removeStaffMeal(input, staffGw as unknown as StaffGw, configGw as unknown as ConfigGw)
  return { staffGw, run }
}

describe('removeStaffMeal', () => {
  it('removes the staff member from the service', async () => {
    const { staffGw, run } = setup(1)

    expect(await run()).toBe('OK')
    expect(staffGw.remove).toHaveBeenCalledWith('school-a', input.teacherId, 'CANTEEN')
  })

  it('reports a staff member who does not eat at that service', async () => {
    expect(await setup(0).run()).toBe('notSubscribed')
  })

  it('refuses while meals are off', async () => {
    const { staffGw, run } = setup(1, null)

    expect(await run()).toBe('mealsDisabled')
    expect(staffGw.remove).not.toHaveBeenCalled()
  })
})
