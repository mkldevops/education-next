import type { z } from 'zod'
import { validateCapacityUpdate } from '@/domain/class-period'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { updateClassPeriodSchema } from './schemas'

type Input = z.infer<typeof updateClassPeriodSchema>

export async function updateClassPeriod(input: Input, classPeriodGw = classPeriodGateway) {
  const parsed = updateClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const classPeriod = await classPeriodGw.findById(parsed.data.id)
  if (!classPeriod) return 'notFound' as const

  if (parsed.data.capacity !== undefined) {
    const enrolled = await classPeriodGw.countEnrolled(parsed.data.id)
    const capacityCheck = validateCapacityUpdate(parsed.data.capacity, enrolled)
    if (capacityCheck !== 'OK') return capacityCheck
  }

  const { id, ...updateData } = parsed.data
  const updated = await classPeriodGw.update(id, updateData)
  return updated
}
