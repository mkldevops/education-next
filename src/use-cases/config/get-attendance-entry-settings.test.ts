import { describe, expect, it, vi } from 'vitest'
import { getAttendanceEntrySettings } from './get-attendance-entry-settings'

const reader = (values: Record<string, string | undefined>) =>
  ({
    get: vi.fn(async (_schoolId: string, name: string) =>
      values[name] === undefined ? null : ({ value: values[name] } as never)
    ),
  }) as unknown as Parameters<typeof getAttendanceEntrySettings>[1] & {
    get: ReturnType<typeof vi.fn>
  }

describe('getAttendanceEntrySettings', () => {
  it('defaults to the list without a required reason', async () => {
    const configGw = reader({})
    expect(await getAttendanceEntrySettings('school-a', configGw)).toEqual({
      mode: 'LIST',
      absenceReasonRequired: false,
    })
    expect(configGw.get).toHaveBeenCalledWith('school-a', 'attendance_entry_mode')
    expect(configGw.get).toHaveBeenCalledWith('school-a', 'attendance_absence_reason_required')
  })

  it('reads the one-by-one mode and a required reason', async () => {
    const configGw = reader({
      attendance_entry_mode: 'ONE_BY_ONE',
      attendance_absence_reason_required: 'true',
    })
    expect(await getAttendanceEntrySettings('school-b', configGw)).toEqual({
      mode: 'ONE_BY_ONE',
      absenceReasonRequired: true,
    })
  })

  it('reads an unknown mode as the list', async () => {
    const configGw = reader({ attendance_entry_mode: 'GRID' })
    expect((await getAttendanceEntrySettings('school-c', configGw)).mode).toBe('LIST')
  })
})
