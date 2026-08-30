import { z } from 'zod'

export const getPlatformSettingSchema = z.object({
  name: z.string().min(1).max(250),
})

export const setPlatformSettingSchema = z.object({
  name: z.string().min(1).max(250),
  value: z.string(),
  valueType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'COLOR']),
})
