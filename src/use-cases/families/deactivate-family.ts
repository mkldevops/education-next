import { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'

const schema = z.object({ id: z.uuid() })

type Input = z.infer<typeof schema>

export async function deactivateFamily(input: Input) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findById(parsed.data.id)
  if (!family) return 'notFound' as const

  await familyGateway.deactivate(parsed.data.id)

  return 'OK' as const
}
