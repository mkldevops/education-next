import { z } from 'zod'

export const setConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
  value: z.string(),
  valueType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'COLOR']),
})

export const getConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
})
