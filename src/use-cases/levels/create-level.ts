import type { z } from 'zod'
import { levelGateway } from '@/gateways/level-gateway'
import { createLevelSchema } from './schemas'

type Input = z.infer<typeof createLevelSchema>

export async function createLevel(input: Input) {
  const parsed = createLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await levelGateway.create(parsed.data)
  return level
}
