import { describe, expect, it, vi } from 'vitest'
import * as decimalModule from '@/lib/decimal'
import { distributePayment, type EnrollmentBalance } from '../payment'

describe('payment distribution', () => {
  describe('distributePayment with positive amounts', () => {
    it('should distribute full payment to single enrollment', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 100,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(100, enrollments)

      expect(result.result).toBe('OK')
      expect(result).toHaveProperty('distribution')
      if (result.result === 'OK') {
        expect(result.distribution).toEqual([{ enrollmentId: 'e1', amount: 100 }])
      }
    })

    it('should distribute partial payment to single enrollment', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 100,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(50, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        expect(result.distribution).toEqual([{ enrollmentId: 'e1', amount: 50 }])
      }
    })

    it('should distribute payment proportionally across multiple enrollments', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 60,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 40,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(100, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        expect(result.distribution).toHaveLength(2)
        const totalDistributed = result.distribution.reduce((sum, d) => sum + d.amount, 0)
        expect(totalDistributed).toBe(100)
      }
    })

    it('should return overpayment error when payment exceeds total remaining balance', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 100,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(150, enrollments)

      expect(result.result).toBe('overpayment')
      expect(result).not.toHaveProperty('distribution')
    })

    it('should return noPayableEnrollments error for empty enrollments', () => {
      const result = distributePayment(100, [])

      expect(result.result).toBe('noPayableEnrollments')
      expect(result).not.toHaveProperty('distribution')
    })

    it('should use HALF_UP rounding for proportional distribution', () => {
      const spy = vi.spyOn(decimalModule, 'roundHalfUp')

      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 50,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 50,
          totalAmount: 100,
          discount: 0,
        },
      ]

      distributePayment(100, enrollments)

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should cap distribution to remaining balance', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 30,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 70,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(80, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        const e1Amount = result.distribution.find((d) => d.enrollmentId === 'e1')?.amount ?? 0
        const e2Amount = result.distribution.find((d) => d.enrollmentId === 'e2')?.amount ?? 0

        expect(e1Amount).toBeLessThanOrEqual(30)
        expect(e2Amount).toBeLessThanOrEqual(70)
      }
    })
  })

  describe('distributePayment with negative amounts (refunds)', () => {
    it('should distribute refund to single enrollment', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 0,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(-50, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        expect(result.distribution).toEqual([{ enrollmentId: 'e1', amount: -50 }])
      }
    })

    it('should distribute refund proportionally to paid amounts', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 0,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 0,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(-100, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        const totalRefunded = result.distribution.reduce((sum, d) => sum + Math.abs(d.amount), 0)
        expect(totalRefunded).toBe(100)
      }
    })

    it('should return refundExceedsPaid error when refund exceeds total paid', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 50,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(-60, enrollments)

      expect(result.result).toBe('refundExceedsPaid')
      expect(result).not.toHaveProperty('distribution')
    })

    it('should calculate paid amount from the already discounted total amount', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 20,
          totalAmount: 100,
          discount: 10,
        },
      ]

      const result = distributePayment(-81, enrollments)

      expect(result.result).toBe('refundExceedsPaid')
    })

    it('should distribute refund based on paid amounts across multiple enrollments', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 30,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 20,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(-70, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        const totalRefunded = result.distribution.reduce((sum, d) => sum + Math.abs(d.amount), 0)
        expect(totalRefunded).toBe(70)
      }
    })

    it('should use HALF_UP rounding for proportional refund distribution', () => {
      const spy = vi.spyOn(decimalModule, 'roundHalfUp')

      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 0,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 0,
          totalAmount: 100,
          discount: 0,
        },
      ]

      distributePayment(-100, enrollments)

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('distributePayment with zero amount', () => {
    it('should return OK with empty distribution for zero amount', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 100,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(0, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        expect(result.distribution).toEqual([])
      }
    })
  })

  describe('distributePayment edge cases', () => {
    it('should handle multiple enrollments with different remaining balances', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 100,
          totalAmount: 200,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 200,
          totalAmount: 300,
          discount: 0,
        },
        {
          enrollmentId: 'e3',
          remainingBalance: 50,
          totalAmount: 150,
          discount: 0,
        },
      ]

      const result = distributePayment(250, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        expect(result.distribution).toHaveLength(3)
        const totalDistributed = result.distribution.reduce((sum, d) => sum + d.amount, 0)
        expect(totalDistributed).toBe(250)
      }
    })

    it('should ensure last enrollment receives remainder to avoid rounding errors', () => {
      const enrollments: EnrollmentBalance[] = [
        {
          enrollmentId: 'e1',
          remainingBalance: 50,
          totalAmount: 100,
          discount: 0,
        },
        {
          enrollmentId: 'e2',
          remainingBalance: 50,
          totalAmount: 100,
          discount: 0,
        },
      ]

      const result = distributePayment(100, enrollments)

      expect(result.result).toBe('OK')
      if (result.result === 'OK') {
        const totalDistributed = result.distribution.reduce((sum, d) => sum + d.amount, 0)
        expect(totalDistributed).toBe(100)
      }
    })
  })
})
