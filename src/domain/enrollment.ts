import type { EnrollmentStatus } from '@/generated/prisma/client'
import { roundHalfUp } from '@/lib/decimal'

export const OPEN_ENROLLMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
] as const satisfies readonly EnrollmentStatus[]

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

export function isCurrencyAmount(amount: number): boolean {
  return Number.isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8
}

/**
 * Le montant à payer est l'entrée utilisateur; la remise reste le format de persistance.
 * Garder cette conversion ici évite que les formulaires, les actions et MCP divergent.
 */
export function pricingFromTotalAmount(
  planAmount: number,
  totalAmount: number
): { discount: number; totalAmount: number } | 'totalAmountExceedsPlan' | 'invalidCurrencyAmount' {
  if (!isCurrencyAmount(totalAmount)) return 'invalidCurrencyAmount'
  if (totalAmount > planAmount) return 'totalAmountExceedsPlan'
  return { totalAmount, discount: planAmount - totalAmount }
}

// Arrondi au centime : 30,30 − 30,299999… vaut 0, pas un « reste » fantôme (#424).
export function calculateRemainingBalance(totalAmount: number, totalPaid: number): number {
  return Math.max(0, roundHalfUp(totalAmount - totalPaid))
}
