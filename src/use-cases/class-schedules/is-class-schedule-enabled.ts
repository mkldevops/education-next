import { cache } from 'react'
import { configGateway } from '@/gateways/config-gateway'
import { CLASS_SCHEDULE_ENABLED_CONFIG_KEY } from '@/lib/class-schedule-config'

const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, CLASS_SCHEDULE_ENABLED_CONFIG_KEY)
    return config?.value === 'true'
  }
)

export function isClassScheduleEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
