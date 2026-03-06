import type { z } from 'zod'
import { validateFamilyName } from '@/domain/family'
import { familyGateway } from '@/gateways/family-gateway'
import { createFamilySchema } from './schemas'

type Input = z.infer<typeof createFamilySchema> & { createdById: string }

export async function createFamily(input: Input) {
  const parsed = createFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const nameCheck = validateFamilyName(parsed.data.name)
  if (nameCheck !== 'OK') return nameCheck

  const family = await familyGateway.create({
    ...parsed.data,
    createdById: input.createdById,
  })

  return family
}
