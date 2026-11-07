export const ATTENDANCE_ENTRY_MODES = ['LIST', 'ONE_BY_ONE'] as const

export type AttendanceEntryMode = (typeof ATTENDANCE_ENTRY_MODES)[number]

/** An absent or unknown value reads as the list, the default for every school. */
export function readAttendanceEntryMode(value: string | null | undefined): AttendanceEntryMode {
  return value === 'ONE_BY_ONE' ? 'ONE_BY_ONE' : 'LIST'
}
