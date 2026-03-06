import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { getConfigSchema } from './schemas'

type Input = z.infer<typeof getConfigSchema>

export async function getConfig(input: Input) {
  const parsed = getConfigSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const config = await configGateway.get(parsed.data.name)
  if (!config) return 'notFound' as const

  return config
}
