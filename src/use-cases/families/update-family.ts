import type { z } from 'zod'
import { validateFamilyName } from '@/domain/family'
import { familyGateway } from '@/gateways/family-gateway'
import { updateFamilySchema } from './schemas'

type Input = z.infer<typeof updateFamilySchema>

export async function updateFamily(input: Input) {
  const parsed = updateFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findById(parsed.data.id)
  if (!family) return 'notFound' as const

  if (parsed.data.name) {
    const nameCheck = validateFamilyName(parsed.data.name)
    if (nameCheck !== 'OK') return nameCheck
  }

  const updated = await familyGateway.update(parsed.data.id, {
    name: parsed.data.name,
    emergencyContact: parsed.data.emergencyContact,
    authorizedPickup: parsed.data.authorizedPickup,
  })

  return updated
}
