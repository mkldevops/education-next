import type { z } from 'zod'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { levelGateway } from '@/gateways/level-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { createClassPeriodSchema } from './schemas'

type Input = z.infer<typeof createClassPeriodSchema>

export async function createClassPeriod(
  input: Input,
  classPeriodGw = classPeriodGateway,
  levelGw = levelGateway,
  periodGw = periodGateway
) {
  const parsed = createClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await levelGw.findById(parsed.data.levelId)
  if (!level) return 'notFound' as const

  const period = await periodGw.findById(parsed.data.periodId)
  if (!period) return 'notFound' as const

  const classPeriod = await classPeriodGw.create(parsed.data)
  return classPeriod
}
