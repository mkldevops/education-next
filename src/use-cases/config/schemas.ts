import { z } from 'zod'

export const setConfigSchema = z.object({
  name: z.string().min(1).max(250),
  value: z.string(),
  valueType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN']),
})

export const getConfigSchema = z.object({
  name: z.string().min(1).max(250),
})
