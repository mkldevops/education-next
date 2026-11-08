import { cache } from 'react'
import { type AttendanceEntryMode, readAttendanceEntryMode } from '@/domain/attendance-entry-mode'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import {
  ATTENDANCE_ABSENCE_REASON_REQUIRED_CONFIG_KEY,
  ATTENDANCE_ENTRY_MODE_CONFIG_KEY,
} from '@/lib/attendance-config'

type ConfigReader = Pick<typeof configGateway, 'get'>

export type AttendanceEntrySettings = {
  mode: AttendanceEntryMode
  absenceReasonRequired: boolean
}

const readSettings = cache(
  async (schoolId: string, configGw: ConfigReader): Promise<AttendanceEntrySettings> => {
    const [mode, required] = await Promise.all([
      configGw.get(schoolId, ATTENDANCE_ENTRY_MODE_CONFIG_KEY),
      configGw.get(schoolId, ATTENDANCE_ABSENCE_REASON_REQUIRED_CONFIG_KEY),
    ])
    return {
      mode: readAttendanceEntryMode(mode?.value),
      absenceReasonRequired: readsAsOptedIn(required?.value),
    }
  }
)

/** How the call is entered (list or one student at a time) and whether an absence needs a reason. */
export function getAttendanceEntrySettings(
  schoolId: string,
  configGw: ConfigReader = configGateway
): Promise<AttendanceEntrySettings> {
  return readSettings(schoolId, configGw)
}
