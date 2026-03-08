import { describe, expect, it } from 'vitest'
import { checkOverlap, validatePeriodDates } from '../period'

describe('period domain', () => {
  describe('validatePeriodDates', () => {
    it('should return OK for valid dates', () => {
      const startAt = new Date('2024-01-01')
      const endAt = new Date('2024-12-31')

      const result = validatePeriodDates(startAt, endAt)

      expect(result).toBe('OK')
    })

    it('should return invalidDates when endAt is before startAt', () => {
      const startAt = new Date('2024-12-31')
      const endAt = new Date('2024-01-01')

      const result = validatePeriodDates(startAt, endAt)

      expect(result).toBe('invalidDates')
    })

    it('should return invalidDates when endAt equals startAt', () => {
      const startAt = new Date('2024-06-15')
      const endAt = new Date('2024-06-15')

      const result = validatePeriodDates(startAt, endAt)

      expect(result).toBe('invalidDates')
    })

    it('should return OK for dates one second apart', () => {
      const startAt = new Date('2024-01-01T00:00:00')
      const endAt = new Date('2024-01-01T00:00:01')

      const result = validatePeriodDates(startAt, endAt)

      expect(result).toBe('OK')
    })
  })

  describe('checkOverlap', () => {
    it('should return OK when no periods exist', () => {
      const startAt = new Date('2024-01-01')
      const endAt = new Date('2024-06-30')

      const result = checkOverlap(startAt, endAt, [])

      expect(result).toBe('OK')
    })

    it('should return overlappingPeriod when periods overlap', () => {
      const startAt = new Date('2024-03-01')
      const endAt = new Date('2024-05-01')

      const existingPeriods = [
        {
          startAt: new Date('2024-02-01'),
          endAt: new Date('2024-04-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('overlappingPeriod')
    })

    it('should return OK when periods do not overlap', () => {
      const startAt = new Date('2024-06-01')
      const endAt = new Date('2024-12-31')

      const existingPeriods = [
        {
          startAt: new Date('2024-01-01'),
          endAt: new Date('2024-05-31'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('OK')
    })

    it('should return overlappingPeriod when new period starts before existing ends', () => {
      const startAt = new Date('2024-03-15')
      const endAt = new Date('2024-08-01')

      const existingPeriods = [
        {
          startAt: new Date('2024-02-01'),
          endAt: new Date('2024-04-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('overlappingPeriod')
    })

    it('should return OK when new period starts exactly when existing ends', () => {
      const startAt = new Date('2024-06-01')
      const endAt = new Date('2024-12-31')

      const existingPeriods = [
        {
          startAt: new Date('2024-01-01'),
          endAt: new Date('2024-06-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('OK')
    })

    it('should return OK when new period ends exactly when existing starts', () => {
      const startAt = new Date('2024-01-01')
      const endAt = new Date('2024-05-31')

      const existingPeriods = [
        {
          startAt: new Date('2024-05-31'),
          endAt: new Date('2024-12-31'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('OK')
    })

    it('should return overlappingPeriod when new period completely contains existing', () => {
      const startAt = new Date('2024-01-01')
      const endAt = new Date('2024-12-31')

      const existingPeriods = [
        {
          startAt: new Date('2024-03-01'),
          endAt: new Date('2024-06-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('overlappingPeriod')
    })

    it('should return overlappingPeriod when existing period completely contains new', () => {
      const startAt = new Date('2024-03-01')
      const endAt = new Date('2024-06-01')

      const existingPeriods = [
        {
          startAt: new Date('2024-01-01'),
          endAt: new Date('2024-12-31'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('overlappingPeriod')
    })

    it('should return OK with multiple non-overlapping periods', () => {
      const startAt = new Date('2024-07-01')
      const endAt = new Date('2024-08-31')

      const existingPeriods = [
        {
          startAt: new Date('2024-01-01'),
          endAt: new Date('2024-03-01'),
        },
        {
          startAt: new Date('2024-04-01'),
          endAt: new Date('2024-06-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('OK')
    })

    it('should return overlappingPeriod when overlapping with one of multiple periods', () => {
      const startAt = new Date('2024-05-01')
      const endAt = new Date('2024-07-01')

      const existingPeriods = [
        {
          startAt: new Date('2024-01-01'),
          endAt: new Date('2024-03-01'),
        },
        {
          startAt: new Date('2024-04-01'),
          endAt: new Date('2024-06-01'),
        },
      ]

      const result = checkOverlap(startAt, endAt, existingPeriods)

      expect(result).toBe('overlappingPeriod')
    })
  })
})
