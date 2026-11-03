import { describe, expect, it } from 'vitest'
import { mealOwner } from './meal-owner'

describe('mealOwner', () => {
  it('names exactly one owner', () => {
    expect(mealOwner({ studentId: 's' })).toEqual({ studentId: 's' })
    expect(mealOwner({ staffMemberId: 'm' })).toEqual({ staffMemberId: 'm' })
  })

  it('rejects none or both', () => {
    expect(mealOwner({})).toBeNull()
    expect(mealOwner({ studentId: 's', staffMemberId: 'm' })).toBeNull()
  })
})
