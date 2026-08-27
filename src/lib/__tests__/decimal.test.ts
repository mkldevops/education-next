import { describe, expect, it } from 'vitest'
import { formatAmount, formatCurrency, roundHalfUp, toNumber } from '../decimal'

describe('decimal utilities', () => {
  describe('roundHalfUp', () => {
    it('should round up with HALF_UP rule at 0.5', () => {
      const result = roundHalfUp(2.005)
      expect(result).toBe(2.01)
    })

    it('should round down below 0.5', () => {
      const result = roundHalfUp(2.004)
      expect(result).toBe(2.0)
    })

    it('should handle multiple decimal places with specified decimals parameter', () => {
      const result = roundHalfUp(2.005, 2)
      expect(result).toBe(2.01)
    })

    it('should round down when below halfway point', () => {
      const result = roundHalfUp(1.234, 2)
      expect(result).toBe(1.23)
    })

    it('should round up when at or above halfway point', () => {
      const result = roundHalfUp(1.235, 2)
      expect(result).toBe(1.24)
    })

    it('should handle zero decimals', () => {
      const result = roundHalfUp(2.5, 0)
      expect(result).toBe(3)
    })

    it('should handle one decimal place', () => {
      const result = roundHalfUp(2.55, 1)
      expect(result).toBe(2.6)
    })

    it('should work with negative numbers', () => {
      const result = roundHalfUp(-2.01, 2)
      expect(result).toBe(-2.01)
    })

    it('should handle very small numbers', () => {
      const result = roundHalfUp(0.005, 2)
      expect(result).toBe(0.01)
    })

    it('should handle large numbers', () => {
      const result = roundHalfUp(1234567.895, 2)
      expect(result).toBe(1234567.9)
    })

    it('should default to 2 decimal places', () => {
      const result = roundHalfUp(1.2345)
      expect(result).toBe(1.23)
    })

    it("should use HALF_UP, not banker's rounding", () => {
      const result = roundHalfUp(2.5, 0)
      expect(result).toBe(3)
    })

    it('should round 1.235 to 1.24 with HALF_UP', () => {
      const result = roundHalfUp(1.235, 2)
      expect(result).toBe(1.24)
    })

    it('should round 3.335 to 3.34 with HALF_UP', () => {
      const result = roundHalfUp(3.335, 2)
      expect(result).toBe(3.34)
    })
  })

  describe('formatAmount', () => {
    it('should format number to 2 decimal places', () => {
      const result = formatAmount(123.456)
      expect(result).toBe('123.46')
    })

    it('should format zero correctly', () => {
      const result = formatAmount(0)
      expect(result).toBe('0.00')
    })

    it('should format amount with one decimal place', () => {
      const result = formatAmount(123.4)
      expect(result).toBe('123.40')
    })

    it('should format amount with no decimal places', () => {
      const result = formatAmount(123)
      expect(result).toBe('123.00')
    })

    it('should handle negative amounts', () => {
      const result = formatAmount(-123.456)
      expect(result).toBe('-123.46')
    })

    it('should handle Prisma Decimal with toNumber method', () => {
      const decimalObj = {
        toNumber: () => 123.456,
        toString: () => '123.456',
      }
      const result = formatAmount(decimalObj)
      expect(result).toBe('123.46')
    })

    it('should handle Prisma Decimal with toString method', () => {
      const decimalObj = {
        toString: () => '123.456',
      }
      const result = formatAmount(decimalObj)
      expect(result).toBe('123.46')
    })

    it('should prefer toNumber over toString', () => {
      const decimalObj = {
        toNumber: () => 100.5,
        toString: () => '999.999',
      }
      const result = formatAmount(decimalObj)
      expect(result).toBe('100.50')
    })

    it('should apply HALF_UP rounding before formatting', () => {
      const result = formatAmount(123.455)
      expect(result).toBe('123.46')
    })

    it('should handle very small decimal values', () => {
      const result = formatAmount(0.005)
      expect(result).toBe('0.01')
    })

    it('should handle large numbers', () => {
      const result = formatAmount(999999.999)
      expect(result).toBe('1000000.00')
    })

    it('should work with object-like Decimal when toNumber returns 0', () => {
      const decimalObj = {
        toNumber: () => 0,
        toString: () => '0',
      }
      const result = formatAmount(decimalObj)
      expect(result).toBe('0.00')
    })

    it('should handle object with only toString method', () => {
      const decimalObj = {
        toString: () => '50.25',
      }
      const result = formatAmount(decimalObj)
      expect(result).toBe('50.25')
    })

    it('should round up amounts at .5 cents', () => {
      const result = formatAmount(99.995)
      expect(result).toBe('100.00')
    })
  })

  describe('formatCurrency', () => {
    const expected = (value: number, locale: string) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)

    it('should format euros for the fr locale', () => {
      expect(formatCurrency(400, 'fr')).toBe(expected(400, 'fr'))
    })

    it('should format euros for the en locale', () => {
      expect(formatCurrency(400, 'en')).toBe(expected(400, 'en'))
    })

    it('should round half up before formatting', () => {
      expect(formatCurrency(99.995, 'en')).toBe(expected(100, 'en'))
    })

    it('should format a Decimal-like object', () => {
      const decimalObj = { toNumber: () => 123.45, toString: () => '123.45' }
      expect(formatCurrency(decimalObj, 'fr')).toBe(expected(123.45, 'fr'))
    })

    it('should format negative amounts', () => {
      expect(formatCurrency(-400, 'fr')).toBe(expected(-400, 'fr'))
    })
  })
})

describe('toNumber', () => {
  it('returns a plain number unchanged', () => {
    expect(toNumber(12.34)).toBe(12.34)
  })

  it('prefers toNumber() when the value exposes one', () => {
    expect(toNumber({ toNumber: () => 7.5, toString: () => 'ignored' })).toBe(7.5)
  })

  it('falls back to the string form when toNumber() is absent', () => {
    expect(toNumber({ toString: () => '19.99' })).toBe(19.99)
  })
})
