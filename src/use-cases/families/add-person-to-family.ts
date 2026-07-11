import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { addPersonToFamilySchema } from './schemas'

type Input = z.infer<typeof addPersonToFamilySchema>

export async function addPersonToFamily(input: Input) {
  const parsed = addPersonToFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findById(parsed.data.familyId)
  if (!family) return 'notFound' as const

  const person = await personGateway.createWithFamily(
    parsed.data.familyId,
    parsed.data.relationType,
    parsed.data.person,
    parsed.data.phoneNumber
  )

  return person
}
