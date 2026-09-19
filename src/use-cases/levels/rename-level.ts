import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { renameLevelSchema } from './schemas'

type Input = z.infer<typeof renameLevelSchema>

export async function renameLevel(input: Input, levelGw = levelGateway) {
  const parsed = renameLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, name } = parsed.data

  const level = await levelGw.findById(schoolId, id)
  if (!level) return 'notFound' as const

  await levelGw.update(schoolId, id, { name })
  return 'OK' as const
}
