import { describe, expect, it, vi } from 'vitest'
import { assignTeacherFromMcp } from './assign-teacher'

describe('assignTeacherFromMcp', () => {
  it('takes the school from the scope, never from the arguments', async () => {
    const assign = vi.fn().mockResolvedValue('OK')

    await assignTeacherFromMcp(
      { schoolId: 'school-1' },
      { classPeriodId: 'c-1', teacherId: 't-1' },
      assign
    )

    expect(assign).toHaveBeenCalledWith({ schoolId: 'school-1', id: 'c-1', teacherId: 't-1' })
  })
})
