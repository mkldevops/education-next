import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { deactivateLevelSchema } from './schemas'

type Input = z.infer<typeof deactivateLevelSchema>

export async function deactivateLevel(input: Input, levelGw = levelGateway) {
  const parsed = deactivateLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await levelGw.findById(parsed.data.schoolId, parsed.data.id)
  if (!level) return 'notFound' as const

  const classPeriods = await levelGw.countClassPeriods(parsed.data.schoolId, parsed.data.id)
  if (classPeriods > 0) return 'levelInUse' as const

  await levelGw.deactivate(parsed.data.schoolId, parsed.data.id)
  return 'OK' as const
}
