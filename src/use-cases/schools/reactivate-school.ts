import type { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolIdSchema } from './schemas'

type Input = z.infer<typeof schoolIdSchema>

export async function reactivateSchool(input: Input, schoolGw = schoolGateway) {
  const parsed = schoolIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const school = await schoolGw.findById(parsed.data.id)
  if (!school) return 'notFound' as const
  if (school.isActive) return 'alreadyActive' as const

  await schoolGw.reactivate(parsed.data.id)
  return 'OK' as const
}
