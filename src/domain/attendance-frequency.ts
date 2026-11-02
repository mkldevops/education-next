export const ATTENDANCE_FREQUENCIES = ['DAILY', 'PER_SLOT'] as const

export type AttendanceFrequency = (typeof ATTENDANCE_FREQUENCIES)[number]

/** Daily calls share one identity across planned lessons and exceptional openings. */
export function attendanceOccurrenceKey(
  frequency: AttendanceFrequency,
  slotId?: string | null
): string {
  return frequency === 'DAILY' ? 'daily' : (slotId ?? 'adhoc')
}
