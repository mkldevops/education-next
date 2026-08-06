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

export function calculateRemainingBalance(totalAmount: number, totalPaid: number): number {
  return Math.max(0, totalAmount - totalPaid)
}
