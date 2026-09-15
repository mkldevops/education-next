import { z } from 'zod'
import { SchoolConfigKey } from '@/lib/school-config'

export const setConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.enum(SchoolConfigKey),
  value: z.string(),
})

export const getConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
})
