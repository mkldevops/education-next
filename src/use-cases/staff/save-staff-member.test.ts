import { describe, expect, it, vi } from 'vitest'
import { createStaffMember, updateStaffMember } from './save-staff-member'

type Gw = Parameters<typeof createStaffMember>[1]

const id = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'

function gateway(updated = true) {
  return {
    create: vi.fn().mockResolvedValue({ id }),
    update: vi.fn().mockResolvedValue(updated),
  }
}

describe('createStaffMember', () => {
  it('trims the name and stores an empty note as null', async () => {
    const gw = gateway()

    expect(
      await createStaffMember(
        { schoolId: 'school-a', name: '  Salima ', note: ' ', mealExempt: false },
        gw as unknown as Gw
      )
    ).toEqual({ id })
    expect(gw.create).toHaveBeenCalledWith('school-a', {
      name: 'Salima',
      note: null,
      mealExempt: false,
    })
  })

  it('refuses an empty name', async () => {
    const gw = gateway()

    expect(
      await createStaffMember(
        { schoolId: 'school-a', name: ' ', mealExempt: false },
        gw as unknown as Gw
      )
    ).toBe('validationError')
    expect(gw.create).not.toHaveBeenCalled()
  })
})

describe('updateStaffMember', () => {
  const input = { schoolId: 'school-a', id, name: 'Salima', mealExempt: true, isActive: false }

  it('updates within the school', async () => {
    const gw = gateway()

    expect(await updateStaffMember(input, gw as unknown as Gw)).toBe('OK')
    expect(gw.update).toHaveBeenCalledWith('school-a', id, {
      name: 'Salima',
      note: null,
      mealExempt: true,
      isActive: false,
    })
  })

  it('reports a member of another school as not found', async () => {
    expect(await updateStaffMember(input, gateway(false) as unknown as Gw)).toBe('notFound')
  })
})
