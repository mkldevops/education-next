import { describe, expect, it } from 'vitest'
import type { EnrollmentStatus } from '@/generated/prisma/client'
import {
  calculateRemainingBalance,
  calculateTotalAmount,
  VALID_TRANSITIONS,
  validateTransition,
} from '../enrollment'

describe('enrollment domain', () => {
  describe('calculateTotalAmount', () => {
    it('should calculate total amount by subtracting discount from plan amount', () => {
      const result = calculateTotalAmount(100, 20)
      expect(result).toBe(80)
    })

    it('should handle zero discount', () => {
      const result = calculateTotalAmount(100, 0)
      expect(result).toBe(100)
    })

    it('should handle full discount', () => {
      const result = calculateTotalAmount(100, 100)
      expect(result).toBe(0)
    })

    it('should work with decimal amounts', () => {
      const result = calculateTotalAmount(99.99, 9.99)
      expect(result).toBeCloseTo(90, 2)
    })
  })

  describe('calculateRemainingBalance', () => {
    it('should subtract payments from the discount-net total amount', () => {
      const result = calculateRemainingBalance(350, 0)
      expect(result).toBe(350)
    })

    it('should return zero when fully paid', () => {
      const result = calculateRemainingBalance(250, 250)
      expect(result).toBe(0)
    })

    it('should never return a negative balance when overpaid', () => {
      const result = calculateRemainingBalance(350, 400)
      expect(result).toBe(0)
    })

    it('should not subtract the discount again when the total is already net', () => {
      const totalAmount = calculateTotalAmount(300, 50)
      const result = calculateRemainingBalance(totalAmount, 200)
      expect(result).toBe(50)
    })
  })

  describe('validateTransition', () => {
    it('should allow PENDING to ACTIVE', () => {
      const result = validateTransition('PENDING', 'ACTIVE')
      expect(result).toBe('OK')
    })

    it('should allow PENDING to CANCELLED', () => {
      const result = validateTransition('PENDING', 'CANCELLED')
      expect(result).toBe('OK')
    })

    it('should allow ACTIVE to COMPLETED', () => {
      const result = validateTransition('ACTIVE', 'COMPLETED')
      expect(result).toBe('OK')
    })

    it('should allow ACTIVE to CANCELLED', () => {
      const result = validateTransition('ACTIVE', 'CANCELLED')
      expect(result).toBe('OK')
    })

    it('should reject COMPLETED to ACTIVE', () => {
      const result = validateTransition('COMPLETED', 'ACTIVE')
      expect(result).toBe('invalidStatusTransition')
    })

    it('should reject COMPLETED to CANCELLED', () => {
      const result = validateTransition('COMPLETED', 'CANCELLED')
      expect(result).toBe('invalidStatusTransition')
    })

    it('should reject CANCELLED to any transition', () => {
      const result = validateTransition('CANCELLED', 'ACTIVE')
      expect(result).toBe('invalidStatusTransition')
    })

    it('should reject PENDING to COMPLETED directly', () => {
      const result = validateTransition('PENDING', 'COMPLETED')
      expect(result).toBe('invalidStatusTransition')
    })
  })

  describe('VALID_TRANSITIONS', () => {
    it('should have transitions defined for all statuses', () => {
      const statuses: EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']
      statuses.forEach((status) => {
        expect(VALID_TRANSITIONS).toHaveProperty(status)
      })
    })

    it('should have no transitions from COMPLETED', () => {
      expect(VALID_TRANSITIONS.COMPLETED).toEqual([])
    })

    it('should have no transitions from CANCELLED', () => {
      expect(VALID_TRANSITIONS.CANCELLED).toEqual([])
    })
  })
})
