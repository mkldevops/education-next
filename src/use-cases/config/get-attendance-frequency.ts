import { cache } from 'react'
import type { AttendanceFrequency } from '@/domain/attendance-frequency'
import { configGateway } from '@/gateways/config-gateway'
import { ATTENDANCE_FREQUENCY_CONFIG_KEY } from '@/lib/attendance-config'

const readFrequency = cache(
  async (
    schoolId: string,
    configGw: Pick<typeof configGateway, 'get'>
  ): Promise<AttendanceFrequency> => {
    const config = await configGw.get(schoolId, ATTENDANCE_FREQUENCY_CONFIG_KEY)
    return config?.value === 'DAILY' ? 'DAILY' : 'PER_SLOT'
  }
)

export function getAttendanceFrequency(
  schoolId: string,
  configGw: Pick<typeof configGateway, 'get'> = configGateway
): Promise<AttendanceFrequency> {
  return readFrequency(schoolId, configGw)
}
