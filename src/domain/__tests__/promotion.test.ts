import type { Enrollment, Level } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { isEligibleForPromotion, type PromotionCandidate } from '../promotion'

describe('promotion domain', () => {
  describe('isEligibleForPromotion', () => {
    const createCandidate = (
      enrollmentStatus: Enrollment['status'],
      hasNextLevel: boolean,
      isNextLevelActive: boolean
    ): PromotionCandidate => ({
      enrollment: {
        id: 'e1',
        studentId: 's1',
        levelId: 'l1',
        classId: 'c1',
        enrollmentDate: new Date(),
        status: enrollmentStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        student: { id: 's1' },
      } as Enrollment & { student: { id: string } },
      currentLevel: {
        id: 'l1',
        code: 'L1',
        name: 'Level 1',
        position: 1,
        isActive: true,
        nextLevelId: hasNextLevel ? 'l2' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        nextLevel: hasNextLevel
          ? {
              id: 'l2',
              code: 'L2',
              name: 'Level 2',
              position: 2,
              isActive: isNextLevelActive,
              nextLevelId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null,
      } as Level & { nextLevel: Level | null },
    })

    it('should return true for ACTIVE enrollment with next level', () => {
      const candidate = createCandidate('ACTIVE', true, true)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(true)
    })

    it('should return true for COMPLETED enrollment with next level', () => {
      const candidate = createCandidate('COMPLETED', true, true)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(true)
    })

    it('should return false for PENDING enrollment', () => {
      const candidate = createCandidate('PENDING', true, true)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })

    it('should return false for CANCELLED enrollment', () => {
      const candidate = createCandidate('CANCELLED', true, true)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })

    it('should return false when there is no next level', () => {
      const candidate = createCandidate('ACTIVE', false, false)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })

    it('should return false when next level is inactive', () => {
      const candidate = createCandidate('ACTIVE', true, false)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })

    it('should return false for ACTIVE enrollment with no next level', () => {
      const candidate = createCandidate('ACTIVE', false, false)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })

    it('should return false for COMPLETED enrollment with inactive next level', () => {
      const candidate = createCandidate('COMPLETED', true, false)

      const result = isEligibleForPromotion(candidate)

      expect(result).toBe(false)
    })
  })
})
