import { describe, expect, it } from 'vitest'
import { mealOwner } from './meal-owner'

describe('mealOwner', () => {
  it('names exactly one owner', () => {
    expect(mealOwner({ studentId: 's' })).toEqual({ studentId: 's' })
    expect(mealOwner({ teacherId: 'm' })).toEqual({ teacherId: 'm' })
  })

  it('rejects none or both', () => {
    expect(mealOwner({})).toBeNull()
    expect(mealOwner({ studentId: 's', teacherId: 'm' })).toBeNull()
  })
})
