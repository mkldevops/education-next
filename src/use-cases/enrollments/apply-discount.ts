import type { z } from 'zod'
import { calculateTotalAmount, pricingFromTotalAmount, validateDiscount } from '@/domain/enrollment'
import { configGateway } from '@/gateways/config-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { roundHalfUp } from '@/lib/decimal'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { applyDiscountSchema } from './schemas'

type Input = z.input<typeof applyDiscountSchema>

export async function applyDiscount(input: Input, configGw = configGateway) {
  const parsed = applyDiscountSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data
  if (!(await isPaymentsEnabled(schoolId, configGw))) return 'paymentsDisabled' as const

  const enrollment = await enrollmentGateway.findById(schoolId, parsed.data.enrollmentId)
  if (!enrollment) return 'notFound' as const
  if (enrollment.status && !['PENDING', 'ACTIVE'].includes(enrollment.status)) {
    return 'notFound' as const
  }

  const planAmount = Number(enrollment.plan.amount)
  let discount = parsed.data.discount
  let totalAmount = calculateTotalAmount(planAmount, discount)
  if (parsed.data.totalAmount !== undefined) {
    const pricing = pricingFromTotalAmount(planAmount, parsed.data.totalAmount)
    if (typeof pricing === 'string') return pricing
    discount = pricing.discount
    totalAmount = pricing.totalAmount
  } else {
    const discountCheck = validateDiscount(planAmount, discount)
    if (discountCheck !== 'OK') return discountCheck
  }
  const totalPaid = roundHalfUp(
    (enrollment.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0)
  )
  if (totalAmount < totalPaid) return 'totalBelowPaid' as const

  await enrollmentGateway.updateDiscount(schoolId, parsed.data.enrollmentId, discount, totalAmount)

  return 'OK' as const
}
