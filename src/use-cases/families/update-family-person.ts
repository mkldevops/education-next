import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { updateFamilyPersonSchema } from './schemas'

type Input = z.infer<typeof updateFamilyPersonSchema>

export async function updateFamilyPerson(input: Input) {
  const parsed = updateFamilyPersonSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, familyId, personId, relationType, phoneNumber, ...person } = parsed.data

  const link = await familyGateway.findPerson(schoolId, familyId, personId)
  if (!link) return 'notFound' as const

  return personGateway.updateWithFamily(schoolId, familyId, personId, {
    person,
    relationType,
    phoneNumber,
  })
}
