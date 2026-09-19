import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { isUniqueConstraintError } from './level-name'
import { createLevelSchema } from './schemas'

type Input = z.infer<typeof createLevelSchema>

export async function createLevel(input: Input, levelGw = levelGateway) {
  const parsed = createLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data

  const homonym = await levelGw.findActiveByName(schoolId, data.name)
  if (homonym) return 'nameTaken' as const

  try {
    return await levelGw.create(schoolId, data)
  } catch (error) {
    if (isUniqueConstraintError(error)) return 'nameTaken' as const
    throw error
  }
}
