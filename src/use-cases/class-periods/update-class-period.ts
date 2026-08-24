import type { z } from 'zod'
import { validateCapacityUpdate } from '@/domain/class-period'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { updateClassPeriodSchema } from './schemas'

type Input = z.infer<typeof updateClassPeriodSchema>

export async function updateClassPeriod(input: Input, classPeriodGw = classPeriodGateway) {
  const parsed = updateClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...updateData } = parsed.data

  const classPeriod = await classPeriodGw.findById(schoolId, id)
  if (!classPeriod) return 'notFound' as const

  if (updateData.capacity !== undefined) {
    const enrolled = await classPeriodGw.countEnrolled(schoolId, id)
    const capacityCheck = validateCapacityUpdate(updateData.capacity, enrolled)
    if (capacityCheck !== 'OK') return capacityCheck
  }

  const updated = await classPeriodGw.update(schoolId, id, updateData)
  return updated
}
