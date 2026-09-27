import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { STRIPE_PRIVATE_CONFIG_KEYS } from '@/lib/stripe-config'
import { getConfigSchema } from './schemas'

type Input = z.infer<typeof getConfigSchema>

export async function getConfig(input: Input, configGw = configGateway) {
  const parsed = getConfigSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  // Un secret chiffré reste un secret : aucune lecture générique ne le renvoie au client.
  if (STRIPE_PRIVATE_CONFIG_KEYS.includes(parsed.data.name)) return 'notFound' as const

  const config = await configGw.get(parsed.data.schoolId, parsed.data.name)
  if (!config) return 'notFound' as const

  return config
}
