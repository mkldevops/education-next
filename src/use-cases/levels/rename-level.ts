import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { isUniqueConstraintError } from './level-name'
import { renameLevelSchema } from './schemas'

type Input = z.infer<typeof renameLevelSchema>

export async function renameLevel(input: Input, levelGw = levelGateway) {
  const parsed = renameLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, name } = parsed.data

  const level = await levelGw.findById(schoolId, id)
  if (!level) return 'notFound' as const

  const homonym = await levelGw.findActiveByName(schoolId, name)
  if (homonym && homonym.id !== id) return 'nameTaken' as const

  try {
    await levelGw.update(schoolId, id, { name })
  } catch (error) {
    if (isUniqueConstraintError(error)) return 'nameTaken' as const
    throw error
  }
  return 'OK' as const
}
