import { describe, expect, it, vi } from 'vitest'
import { setStaffMealExempt } from './set-staff-meal-exempt'

type Gw = Parameters<typeof setStaffMealExempt>[1]

const id = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'

describe('setStaffMealExempt', () => {
  it('exempts a teacher of the school', async () => {
    const gw = { setMealExempt: vi.fn().mockResolvedValue(true) }

    expect(
      await setStaffMealExempt({ schoolId: 'school-a', id, mealExempt: true }, gw as unknown as Gw)
    ).toBe('OK')
    expect(gw.setMealExempt).toHaveBeenCalledWith('school-a', id, true)
  })

  it('reports a teacher of another school as not found', async () => {
    const gw = { setMealExempt: vi.fn().mockResolvedValue(false) }

    expect(
      await setStaffMealExempt({ schoolId: 'school-a', id, mealExempt: false }, gw as unknown as Gw)
    ).toBe('notFound')
  })

  it('refuses a malformed id', async () => {
    const gw = { setMealExempt: vi.fn() }

    expect(
      await setStaffMealExempt(
        { schoolId: 'school-a', id: 'x', mealExempt: true },
        gw as unknown as Gw
      )
    ).toBe('validationError')
    expect(gw.setMealExempt).not.toHaveBeenCalled()
  })
})
