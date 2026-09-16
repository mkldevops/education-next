import { describe, expect, it } from 'vitest'
import { createClassScheduleSlotSchema, updateClassScheduleSlotSchema } from './schemas'

const slot = {
  schoolId: 'school-1',
  classPeriodId: '10000000-0000-4000-8000-000000000001',
  weekday: 1,
  startTime: '08:00',
  endTime: '09:00',
}

describe('class schedule slot schemas', () => {
  it('allows a draft slot without teachers on create and update', () => {
    expect(createClassScheduleSlotSchema.safeParse({ ...slot, teacherIds: [] }).success).toBe(true)
    expect(
      updateClassScheduleSlotSchema.safeParse({
        ...slot,
        id: '10000000-0000-4000-8000-000000000002',
        teacherIds: [],
      }).success
    ).toBe(true)
  })

  it('still rejects repeated teacher ids', () => {
    expect(
      createClassScheduleSlotSchema.safeParse({
        ...slot,
        teacherIds: [
          '10000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000003',
        ],
      }).success
    ).toBe(false)
  })

  it('normalizes a blank description and limits its length', () => {
    expect(
      createClassScheduleSlotSchema.parse({ ...slot, description: '', teacherIds: [] }).description
    ).toBeNull()
    expect(
      createClassScheduleSlotSchema.safeParse({
        ...slot,
        description: 'a'.repeat(501),
        teacherIds: [],
      }).success
    ).toBe(false)
  })
})
