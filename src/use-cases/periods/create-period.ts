import type { z } from 'zod'
import { validatePeriodDates } from '@/domain/period'
import { periodGateway } from '@/gateways/period-gateway'
import { createPeriodSchema } from './schemas'

type Input = z.infer<typeof createPeriodSchema>

export async function createPeriod(input: Input) {
  const parsed = createPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const datesCheck = validatePeriodDates(parsed.data.startAt, parsed.data.endAt)
  if (datesCheck !== 'OK') return datesCheck

  const hasOverlap = await periodGateway.checkOverlap(parsed.data.startAt, parsed.data.endAt)
  if (hasOverlap) return 'overlappingPeriod' as const

  const period = await periodGateway.create(parsed.data)
  return period
}
