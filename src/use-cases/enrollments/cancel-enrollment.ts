import type { z } from 'zod'
import { validateTransition } from '@/domain/enrollment'
import { classAssignmentGateway } from '@/gateways/class-assignment-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { enrollmentIdSchema } from './schemas'

type Input = z.infer<typeof enrollmentIdSchema>

export async function cancelEnrollment(input: Input) {
  const parsed = enrollmentIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data

  const enrollment = await enrollmentGateway.findById(schoolId, parsed.data.id)
  if (!enrollment) return 'notFound' as const

  const transitionCheck = validateTransition(enrollment.status, 'CANCELLED')
  if (transitionCheck !== 'OK') return transitionCheck

  await classAssignmentGateway.closeCurrent(schoolId, parsed.data.id)
  await enrollmentGateway.updateStatus(schoolId, parsed.data.id, 'CANCELLED')
  return 'OK' as const
}
