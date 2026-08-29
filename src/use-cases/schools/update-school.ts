import type { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { updateSchoolSchema } from './schemas'

type Input = z.infer<typeof updateSchoolSchema>

export async function updateSchool(input: Input, schoolGw = schoolGateway) {
  const parsed = updateSchoolSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { id, ...data } = parsed.data

  const school = await schoolGw.findById(id)
  if (!school) return 'notFound' as const

  const conflict = await schoolGw.findBySlug(data.slug)
  if (conflict && conflict.id !== id) return 'slugAlreadyUsed' as const

  await schoolGw.update(id, data)
  return 'OK' as const
}
