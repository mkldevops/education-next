import { describe, expect, it } from 'vitest'
import { checkOverlap, selectDefaultPeriod, validatePeriodDates } from '../period'

function period(id: string, startAt: string, endAt: string, hasClasses = false) {
  return { id, startAt: new Date(startAt), endAt: new Date(endAt), hasClasses }
}

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

  describe('selectDefaultPeriod', () => {
    const now = new Date('2026-08-05')

    it('should return null when no period exists', () => {
      expect(selectDefaultPeriod([], now)).toBeNull()
    })

    it('should return the period containing the current date', () => {
      const current = period('current', '2025-09-01', '2026-08-31')
      const periods = [period('next', '2026-09-01', '2027-08-31', true), current]

      expect(selectDefaultPeriod(periods, now)).toBe(current)
    })

    it('should prefer the current period over a more recent one with classes', () => {
      const current = period('current', '2025-09-01', '2026-08-31')
      const periods = [period('next', '2026-09-01', '2027-08-31', true), current]

      expect(selectDefaultPeriod(periods, now)?.id).toBe('current')
    })

    it('should include boundary dates in the current period', () => {
      const startingToday = period('starting', '2026-08-05', '2027-06-30')

      expect(selectDefaultPeriod([startingToday], now)).toBe(startingToday)
      expect(selectDefaultPeriod([period('ending', '2025-09-01', '2026-08-05')], now)?.id).toBe(
        'ending'
      )
    })

    it('should fall back to the most recent period with at least one class', () => {
      const periods = [
        period('empty', '2026-09-01', '2027-08-31'),
        period('withClasses', '2025-09-01', '2026-06-30', true),
        period('older', '2024-09-01', '2025-06-30', true),
      ]

      expect(selectDefaultPeriod(periods, now)?.id).toBe('withClasses')
    })

    it('should fall back to the most recent period when none has classes', () => {
      const periods = [
        period('older', '2024-09-01', '2025-06-30'),
        period('newest', '2026-09-01', '2027-08-31'),
      ]

      expect(selectDefaultPeriod(periods, now)?.id).toBe('newest')
    })

    it('should not depend on the input order', () => {
      const periods = [
        period('withClasses', '2025-09-01', '2026-06-30', true),
        period('empty', '2026-09-01', '2027-08-31'),
      ]

      expect(selectDefaultPeriod(periods, now)?.id).toBe('withClasses')
    })

    it('should not mutate the given array', () => {
      const periods = [
        period('older', '2024-09-01', '2025-06-30'),
        period('newest', '2026-09-01', '2027-08-31'),
      ]

      selectDefaultPeriod(periods, now)

      expect(periods[0]?.id).toBe('older')
    })
  })
})
