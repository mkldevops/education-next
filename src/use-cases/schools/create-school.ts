import type { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { createSchoolSchema } from './schemas'

type Input = z.infer<typeof createSchoolSchema>

export async function createSchool(input: Input, schoolGw = schoolGateway) {
  const parsed = createSchoolSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  // Recherche non filtrée sur `isActive` : le slug est unique en base, donc une école
  // désactivée le retient toujours et le conflit doit être annoncé plutôt que subi.
  const conflict = await schoolGw.findBySlug(parsed.data.slug)
  if (conflict) return 'slugAlreadyUsed' as const

  return schoolGw.create(parsed.data)
}
