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
  const { schoolId } = parsed.data

  const enrollment = await enrollmentGateway.findById(schoolId, parsed.data.enrollmentId)
  if (!enrollment) return 'notFound' as const

  if (enrollment.status !== 'PENDING' && enrollment.status !== 'ACTIVE') {
    return 'invalidStatusTransition' as const
  }

  const classPeriod = await classPeriodGateway.findById(schoolId, parsed.data.newClassPeriodId)
  if (!classPeriod) return 'notFound' as const

  const enrolled = await classPeriodGateway.countEnrolled(schoolId, parsed.data.newClassPeriodId)
  const capacityCheck = checkCapacity(classPeriod.capacity, enrolled)
  if (capacityCheck !== 'OK') return capacityCheck

  await classAssignmentGateway.closeCurrent(schoolId, parsed.data.enrollmentId)
  await classAssignmentGateway.create(schoolId, {
    enrollmentId: parsed.data.enrollmentId,
    classPeriodId: parsed.data.newClassPeriodId,
  })

  return 'OK' as const
}
