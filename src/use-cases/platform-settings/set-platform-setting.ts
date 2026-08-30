import type { z } from 'zod'
import { platformSettingGateway } from '@/gateways/platform-setting-gateway'
import { setPlatformSettingSchema } from './schemas'

type Input = z.infer<typeof setPlatformSettingSchema>

function validateValueType(value: string, valueType: string): boolean {
  switch (valueType) {
    case 'NUMBER':
      return !Number.isNaN(Number(value))
    case 'BOOLEAN':
      return value === 'true' || value === 'false'
    default:
      return true
  }
}

export async function setPlatformSetting(input: Input, settingGw = platformSettingGateway) {
  const parsed = setPlatformSettingSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  if (!validateValueType(parsed.data.value, parsed.data.valueType)) {
    return 'invalidSettingValue' as const
  }

  return settingGw.set(parsed.data)
}
