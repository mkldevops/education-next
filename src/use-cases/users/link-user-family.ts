import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { userGateway } from '@/gateways/user-gateway'
import { userFamilySchema } from './schemas'

type Input = z.infer<typeof userFamilySchema>

export async function linkUserFamily(schoolId: string, input: Input) {
  const parsed = userFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const

  const family = await familyGateway.findById(schoolId, parsed.data.familyId)
  if (!family) return 'familyNotFound' as const

  const existing = await userGateway.hasFamilyLink(parsed.data.id, parsed.data.familyId, schoolId)
  if (existing) return 'alreadyLinked' as const

  const linked = await userGateway.linkFamily(parsed.data.id, parsed.data.familyId, schoolId)
  return linked ? ('OK' as const) : ('familyNotFound' as const)
}

export async function unlinkUserFamily(schoolId: string, input: Input) {
  const parsed = userFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const existing = await userGateway.hasFamilyLink(parsed.data.id, parsed.data.familyId, schoolId)
  if (!existing) return 'notFound' as const

  const deleted = await userGateway.unlinkFamily(parsed.data.id, parsed.data.familyId, schoolId)
  return deleted && deleted.count > 0 ? ('OK' as const) : ('notFound' as const)
}
