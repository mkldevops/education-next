import type { z } from 'zod'
import { validatePeriodDates } from '@/domain/period'
import { periodGateway } from '@/gateways/period-gateway'
import { updatePeriodSchema } from './schemas'

type Input = z.infer<typeof updatePeriodSchema>

export async function updatePeriod(input: Input, periodGw = periodGateway) {
  const parsed = updatePeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...updateData } = parsed.data

  const period = await periodGw.findById(schoolId, id)
  if (!period) return 'notFound' as const

  const startAt = updateData.startAt ?? period.startAt
  const endAt = updateData.endAt ?? period.endAt

  if (updateData.startAt || updateData.endAt) {
    const datesCheck = validatePeriodDates(startAt, endAt)
    if (datesCheck !== 'OK') return datesCheck

    const hasOverlap = await periodGw.checkOverlap(schoolId, startAt, endAt, id)
    if (hasOverlap) return 'overlappingPeriod' as const
  }

  const updated = await periodGw.update(schoolId, id, updateData)
  return updated
}
