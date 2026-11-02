import { describe, expect, it, vi } from 'vitest'
import { getAttendanceFrequency } from './get-attendance-frequency'

describe('getAttendanceFrequency', () => {
  it.each([null, 'PER_SLOT', 'invalid', 'true'])('defaults to PER_SLOT for %s', async (value) => {
    const get = vi.fn().mockResolvedValue(value === null ? null : { value })
    expect(await getAttendanceFrequency('school-a', { get })).toBe('PER_SLOT')
    expect(get).toHaveBeenCalledWith('school-a', 'attendance_frequency')
  })

  it('opts only the requesting school into daily attendance', async () => {
    const get = vi
      .fn()
      .mockImplementation(async (schoolId) => ({ value: schoolId === 'a' ? 'DAILY' : 'PER_SLOT' }))
    expect(await getAttendanceFrequency('a', { get })).toBe('DAILY')
    expect(await getAttendanceFrequency('b', { get })).toBe('PER_SLOT')
  })
})
