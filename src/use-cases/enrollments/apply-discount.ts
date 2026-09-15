import type { z } from 'zod'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { configGateway } from '@/gateways/config-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { applyDiscountSchema } from './schemas'

type Input = z.infer<typeof applyDiscountSchema>

export async function applyDiscount(input: Input, configGw = configGateway) {
  const parsed = applyDiscountSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const enrollment = await enrollmentGateway.findById(schoolId, parsed.data.enrollmentId)
  if (!enrollment) return 'notFound' as const

  const planAmount = Number(enrollment.plan.amount)

  const discountCheck = validateDiscount(planAmount, parsed.data.discount)
  if (discountCheck !== 'OK') return discountCheck

  const totalAmount = calculateTotalAmount(planAmount, parsed.data.discount)

  await enrollmentGateway.updateDiscount(
    schoolId,
    parsed.data.enrollmentId,
    parsed.data.discount,
    totalAmount
  )

  return 'OK' as const
}
