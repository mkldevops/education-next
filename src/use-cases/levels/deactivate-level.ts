import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { deactivateLevelSchema } from './schemas'

type Input = z.infer<typeof deactivateLevelSchema>

export async function deactivateLevel(input: Input, levelGw = levelGateway) {
  const parsed = deactivateLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id } = parsed.data

  const level = await levelGw.findById(schoolId, id)
  if (!level) return 'notFound' as const

  const classPeriods = await levelGw.countClassPeriods(schoolId, id)
  if (classPeriods > 0) return 'levelInUse' as const

  await levelGw.deactivate(schoolId, id)
  return 'OK' as const
}
