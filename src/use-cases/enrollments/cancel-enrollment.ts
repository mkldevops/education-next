import type { z } from 'zod'
import { validateTransition } from '@/domain/enrollment'
import { classAssignmentGateway } from '@/gateways/class-assignment-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { enrollmentIdSchema } from './schemas'

type Input = z.infer<typeof enrollmentIdSchema>

export async function cancelEnrollment(input: Input) {
  const parsed = enrollmentIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const enrollment = await enrollmentGateway.findById(parsed.data.id)
  if (!enrollment) return 'notFound' as const

  const transitionCheck = validateTransition(enrollment.status, 'CANCELLED')
  if (transitionCheck !== 'OK') return transitionCheck

  await classAssignmentGateway.closeCurrent(parsed.data.id)
  await enrollmentGateway.updateStatus(parsed.data.id, 'CANCELLED')
  return 'OK' as const
}
