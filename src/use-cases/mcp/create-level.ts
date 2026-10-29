import type { z } from 'zod'
import { createLevel } from '@/use-cases/levels/create-level'
import { mcpCreateLevelSchema } from './schemas'

export async function createLevelFromMcp(
  scope: { schoolId: string },
  input: z.input<typeof mcpCreateLevelSchema>,
  create = createLevel
) {
  const parsed = mcpCreateLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await create({ ...parsed.data, schoolId: scope.schoolId })
  if (typeof level === 'string') return level
  return { id: level.id, name: level.name }
}
