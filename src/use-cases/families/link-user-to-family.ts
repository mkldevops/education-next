import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { linkUserToFamilySchema } from './schemas'

type Input = z.infer<typeof linkUserToFamilySchema>

export async function linkUserToFamily(input: Input) {
  const parsed = linkUserToFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findById(parsed.data.familyId)
  if (!family) return 'notFound' as const

  await familyGateway.linkUser(parsed.data.userId, parsed.data.familyId)

  return 'OK' as const
}
