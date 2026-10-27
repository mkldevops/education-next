import { describe, expect, it } from 'vitest'
import { absentFromAllCalls } from '../meal-absence-from-attendance'

describe('absentFromAllCalls', () => {
  it('keeps a student absent from every call', () => {
    const entries = [
      { studentId: 'a', status: 'ABSENT' as const },
      { studentId: 'a', status: 'ABSENT' as const },
    ]

    expect(absentFromAllCalls(entries)).toEqual(new Set(['a']))
  })

  it('drops a student present or late at one call', () => {
    const entries = [
      { studentId: 'a', status: 'ABSENT' as const },
      { studentId: 'a', status: 'LATE' as const },
      { studentId: 'b', status: 'ABSENT' as const },
      { studentId: 'b', status: 'PRESENT' as const },
    ]

    expect(absentFromAllCalls(entries)).toEqual(new Set())
  })

  it('ignores a call where the student was not recorded', () => {
    const entries = [
      { studentId: 'a', status: 'ABSENT' as const },
      { studentId: 'a', status: 'NOT_RECORDED' as const },
      { studentId: 'b', status: 'NOT_RECORDED' as const },
    ]

    expect(absentFromAllCalls(entries)).toEqual(new Set(['a']))
  })
})
