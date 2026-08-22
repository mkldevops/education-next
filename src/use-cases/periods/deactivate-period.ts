import type { z } from 'zod'
import { periodGateway } from '@/gateways/period-gateway'
import { deactivatePeriodSchema } from './schemas'

type Input = z.infer<typeof deactivatePeriodSchema>

export async function deactivatePeriod(input: Input, periodGw = periodGateway) {
  const parsed = deactivatePeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const period = await periodGw.findById(parsed.data.schoolId, parsed.data.id)
  if (!period) return 'notFound' as const

  const classPeriods = await periodGw.countClassPeriods(parsed.data.schoolId, parsed.data.id)
  if (classPeriods > 0) return 'periodInUse' as const

  await periodGw.deactivate(parsed.data.schoolId, parsed.data.id)
  return 'OK' as const
}
