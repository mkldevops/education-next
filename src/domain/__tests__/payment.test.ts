import { describe, expect, it } from 'vitest'
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

    it('splits into whole euros, the extra euro going to the first enrollments', () => {
      const three = [
        { enrollmentId: 'e1', remainingBalance: 180, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e2', remainingBalance: 180, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e3', remainingBalance: 180, totalAmount: 180, discount: 0 },
      ]

      expect(distributePayment(100, three)).toEqual({
        result: 'OK',
        distribution: [
          { enrollmentId: 'e1', amount: 34 },
          { enrollmentId: 'e2', amount: 33 },
          { enrollmentId: 'e3', amount: 33 },
        ],
      })
      expect(distributePayment(101, three)).toMatchObject({
        distribution: [{ amount: 34 }, { amount: 34 }, { amount: 33 }],
      })
    })

    it('keeps whole euros across unequal balances', () => {
      const result = distributePayment(75, [
        { enrollmentId: 'e1', remainingBalance: 90, totalAmount: 90, discount: 0 },
        { enrollmentId: 'e2', remainingBalance: 90, totalAmount: 90, discount: 0 },
        { enrollmentId: 'e3', remainingBalance: 180, totalAmount: 180, discount: 0 },
      ])

      expect(result).toMatchObject({
        distribution: [{ amount: 19 }, { amount: 19 }, { amount: 37 }],
      })
    })

    it('never gives the extra euro to an enrollment already paid off by its share', () => {
      const result = distributePayment(3, [
        { enrollmentId: 'e1', remainingBalance: 1, totalAmount: 90, discount: 0 },
        { enrollmentId: 'e2', remainingBalance: 1, totalAmount: 90, discount: 0 },
        { enrollmentId: 'e3', remainingBalance: 1, totalAmount: 90, discount: 0 },
      ])

      expect(result).toMatchObject({
        distribution: [{ amount: 1 }, { amount: 1 }, { amount: 1 }],
      })
    })

    it('leaves only the cents of a non-whole amount fractional', () => {
      const result = distributePayment(100.5, [
        { enrollmentId: 'e1', remainingBalance: 180, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e2', remainingBalance: 180, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e3', remainingBalance: 180, totalAmount: 180, discount: 0 },
      ])

      expect(result).toMatchObject({
        distribution: [{ amount: 34 }, { amount: 33.5 }, { amount: 33 }],
      })
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

    it('splits a refund into whole euros too', () => {
      const result = distributePayment(-100, [
        { enrollmentId: 'e1', remainingBalance: 80, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e2', remainingBalance: 80, totalAmount: 180, discount: 0 },
        { enrollmentId: 'e3', remainingBalance: 80, totalAmount: 180, discount: 0 },
      ])

      expect(result).toMatchObject({
        distribution: [{ amount: -34 }, { amount: -33 }, { amount: -33 }],
      })
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
