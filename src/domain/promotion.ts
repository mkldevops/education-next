import type { Enrollment, Level } from '@prisma/client'

export interface PromotionCandidate {
  enrollment: Enrollment & { student: { id: string } }
  currentLevel: Level & { nextLevel: Level | null }
}

export function isEligibleForPromotion(candidate: PromotionCandidate): boolean {
  if (!['ACTIVE', 'COMPLETED'].includes(candidate.enrollment.status)) {
    return false
  }

  if (!candidate.currentLevel.nextLevel) {
    return false
  }

  if (!candidate.currentLevel.nextLevel.isActive) {
    return false
  }

  return true
}
