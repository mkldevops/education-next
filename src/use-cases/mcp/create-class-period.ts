import type { z } from 'zod'
import { createClassPeriod } from '@/use-cases/class-periods/create-class-period'
import { mcpCreateClassPeriodSchema } from './schemas'

export async function createClassPeriodFromMcp(
  scope: { schoolId: string },
  input: z.input<typeof mcpCreateClassPeriodSchema>,
  create = createClassPeriod
) {
  const parsed = mcpCreateClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const classPeriod = await create({ ...parsed.data, schoolId: scope.schoolId })
  if (typeof classPeriod === 'string') return classPeriod
  return {
    id: classPeriod.id,
    name: classPeriod.name,
    capacity: classPeriod.capacity,
    levelId: classPeriod.levelId,
    periodId: classPeriod.periodId,
  }
}
