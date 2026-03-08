import type { z } from 'zod'
import { validatePeriodDates } from '@/domain/period'
import { periodGateway } from '@/gateways/period-gateway'
import { updatePeriodSchema } from './schemas'

type Input = z.infer<typeof updatePeriodSchema>

export async function updatePeriod(input: Input, periodGw = periodGateway) {
  const parsed = updatePeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const period = await periodGw.findById(parsed.data.id)
  if (!period) return 'notFound' as const

  const startAt = parsed.data.startAt ?? period.startAt
  const endAt = parsed.data.endAt ?? period.endAt

  if (parsed.data.startAt || parsed.data.endAt) {
    const datesCheck = validatePeriodDates(startAt, endAt)
    if (datesCheck !== 'OK') return datesCheck

    const hasOverlap = await periodGw.checkOverlap(startAt, endAt, parsed.data.id)
    if (hasOverlap) return 'overlappingPeriod' as const
  }

  const { id, ...updateData } = parsed.data
  const updated = await periodGw.update(id, updateData)
  return updated
}
