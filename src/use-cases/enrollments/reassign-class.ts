import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { classAssignmentGateway } from '@/gateways/class-assignment-gateway'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { reassignClassSchema } from './schemas'

type Input = z.infer<typeof reassignClassSchema>

export async function reassignClass(input: Input) {
  const parsed = reassignClassSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const enrollment = await enrollmentGateway.findById(parsed.data.enrollmentId)
  if (!enrollment) return 'notFound' as const

  if (enrollment.status !== 'PENDING' && enrollment.status !== 'ACTIVE') {
    return 'invalidStatusTransition' as const
  }

  const classPeriod = await classPeriodGateway.findById(parsed.data.newClassPeriodId)
  if (!classPeriod) return 'notFound' as const

  const enrolled = await classPeriodGateway.countEnrolled(parsed.data.newClassPeriodId)
  const capacityCheck = checkCapacity(classPeriod.capacity, enrolled)
  if (capacityCheck !== 'OK') return capacityCheck

  await classAssignmentGateway.closeCurrent(parsed.data.enrollmentId)
  await classAssignmentGateway.create({
    enrollmentId: parsed.data.enrollmentId,
    classPeriodId: parsed.data.newClassPeriodId,
  })

  return 'OK' as const
}
