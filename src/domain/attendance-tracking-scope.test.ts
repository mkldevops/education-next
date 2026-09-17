import { expect, it } from 'vitest'
import { attendanceClassPeriodScope } from './attendance-tracking-scope'

it('does not construct a query without a selected period', () => {
  expect(attendanceClassPeriodScope({})).toBeNull()
})

it('bounds a teacher view to the assigned teacher and period', () => {
  expect(attendanceClassPeriodScope({ periodId: 'period', teacherId: 'teacher' })).toEqual({
    isActive: true,
    periodId: 'period',
    teachers: { some: { teacherId: 'teacher' } },
  })
})

it('keeps a planned class filter in the period scope', () => {
  expect(attendanceClassPeriodScope({ periodId: 'period', classId: 'class' })).toMatchObject({
    periodId: 'period',
    id: 'class',
  })
})
