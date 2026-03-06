import type { z } from 'zod'
import { calculateTotalAmount } from '@/domain/enrollment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { applyDiscountSchema } from './schemas'

type Input = z.infer<typeof applyDiscountSchema>

export async function applyDiscount(input: Input) {
  const parsed = applyDiscountSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const enrollment = await enrollmentGateway.findById(parsed.data.enrollmentId)
  if (!enrollment) return 'notFound' as const

  const totalAmount = calculateTotalAmount(Number(enrollment.plan.amount), parsed.data.discount)

  await enrollmentGateway.updateDiscount(
    parsed.data.enrollmentId,
    parsed.data.discount,
    totalAmount
  )

  return 'OK' as const
}
