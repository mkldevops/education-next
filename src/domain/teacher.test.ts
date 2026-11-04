import { describe, expect, it } from 'vitest'
import { splitTeacherName, staffMealDue } from './teacher'

describe('splitTeacherName', () => {
  it('keeps a single word as the first name', () => {
    expect(splitTeacherName(' Kaniza ')).toEqual({ firstName: 'Kaniza', lastName: '' })
  })

  it('takes the first word as first name and the rest as last name', () => {
    expect(splitTeacherName('Ali  Ben Zakia')).toEqual({ firstName: 'Ali', lastName: 'Ben Zakia' })
  })
})

describe('staffMealDue', () => {
  const coverage = { dueDays: 3, dueAmount: 2250 }

  it('keeps the dues of a billed member', () => {
    expect(staffMealDue(coverage, false)).toEqual(coverage)
  })

  it('owes nothing when exempt or without an account', () => {
    expect(staffMealDue(coverage, true)).toEqual({ dueDays: 0, dueAmount: 0 })
    expect(staffMealDue(undefined, false)).toEqual({ dueDays: 0, dueAmount: 0 })
  })
})
