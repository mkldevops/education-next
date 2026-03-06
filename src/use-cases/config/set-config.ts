import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { setConfigSchema } from './schemas'

type Input = z.infer<typeof setConfigSchema>

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

export async function setConfig(input: Input) {
  const parsed = setConfigSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  if (!validateValueType(parsed.data.value, parsed.data.valueType)) {
    return 'invalidConfigValue' as const
  }

  const config = await configGateway.set(parsed.data)
  return config
}
