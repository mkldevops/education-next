import type { EnrollmentStatus } from '@/generated/prisma/client'

/**
 * Statuts d'inscription qui occupent une place, avec une affectation ouverte (`endAt: null`).
 * Une inscription annulée libère sa place ; une inscription terminée la garde tant que son
 * affectation reste ouverte. Seul prédicat d'occupation : création, réaffectation, promotion,
 * réduction de capacité, aperçu et engagement MCP, tableau de bord.
 */
export const SEAT_HOLDING_ENROLLMENT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'COMPLETED',
] as const satisfies readonly EnrollmentStatus[]

export function checkCapacity(capacity: number, currentEnrolled: number): 'OK' | 'classFull' {
  return currentEnrolled < capacity ? 'OK' : 'classFull'
}

export function validateCapacityUpdate(
  newCapacity: number,
  currentEnrolled: number
): 'OK' | 'capacityBelowEnrolled' {
  return newCapacity >= currentEnrolled ? 'OK' : 'capacityBelowEnrolled'
}
