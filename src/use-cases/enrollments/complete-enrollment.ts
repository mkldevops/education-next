import type { z } from 'zod'
import { validateTransition } from '@/domain/enrollment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { enrollmentIdSchema } from './schemas'

type Input = z.infer<typeof enrollmentIdSchema>

export async function completeEnrollment(input: Input) {
  const parsed = enrollmentIdSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const enrollment = await enrollmentGateway.findById(parsed.data.id)
  if (!enrollment) return 'notFound' as const

  const transitionCheck = validateTransition(enrollment.status, 'COMPLETED')
  if (transitionCheck !== 'OK') return transitionCheck

  await enrollmentGateway.updateStatus(parsed.data.id, 'COMPLETED')
  return 'OK' as const
}
