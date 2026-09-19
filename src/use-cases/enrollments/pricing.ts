import { calculateTotalAmount, pricingFromTotalAmount, validateDiscount } from '@/domain/enrollment'

export function resolveEnrollmentPricing(
  planAmount: number,
  discount: number,
  totalAmount?: number
) {
  if (totalAmount !== undefined) return pricingFromTotalAmount(planAmount, totalAmount)
  const check = validateDiscount(planAmount, discount)
  if (check !== 'OK') return check
  return { discount, totalAmount: calculateTotalAmount(planAmount, discount) }
}
