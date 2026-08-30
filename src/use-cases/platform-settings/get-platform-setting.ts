import type { z } from 'zod'
import { platformSettingGateway } from '@/gateways/platform-setting-gateway'
import { getPlatformSettingSchema } from './schemas'

type Input = z.infer<typeof getPlatformSettingSchema>

export async function getPlatformSetting(input: Input, settingGw = platformSettingGateway) {
  const parsed = getPlatformSettingSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const setting = await settingGw.get(parsed.data.name)
  if (!setting) return 'notFound' as const

  return setting
}
