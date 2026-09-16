import type { EnrollmentStatus } from '@/generated/prisma/client'

export const VALID_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  PENDING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function validateTransition(
  currentStatus: EnrollmentStatus,
  newStatus: EnrollmentStatus
): 'OK' | 'invalidStatusTransition' {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus]
  if (!allowedTransitions.includes(newStatus)) {
    return 'invalidStatusTransition'
  }
  return 'OK'
}

export function validateDiscount(
  planAmount: number,
  discount: number
): 'OK' | 'discountExceedsPlan' {
  return discount <= planAmount ? 'OK' : 'discountExceedsPlan'
}

export function calculateTotalAmount(planAmount: number, discount: number): number {
  return planAmount - discount
}

/**
 * Le montant à payer est l'entrée utilisateur; la remise reste le format de persistance.
 * Garder cette conversion ici évite que les formulaires, les actions et MCP divergent.
 */
export function pricingFromTotalAmount(
  planAmount: number,
  totalAmount: number
): { discount: number; totalAmount: number } | 'totalAmountExceedsPlan' {
  if (totalAmount > planAmount) return 'totalAmountExceedsPlan'
  return { totalAmount, discount: planAmount - totalAmount }
}

export function calculateRemainingBalance(totalAmount: number, totalPaid: number): number {
  return Math.max(0, totalAmount - totalPaid)
}
