import { describe, expect, it } from 'vitest'
import { validateStudentBirthday } from '../student'

describe('student domain', () => {
  describe('validateStudentBirthday', () => {
    it('should return OK for past date', () => {
      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 10)

      const result = validateStudentBirthday(pastDate)
      expect(result).toBe('OK')
    })

    it('should return validationError for future date', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const result = validateStudentBirthday(futureDate)
      expect(result).toBe('validationError')
    })

    it('should return validationError for today', () => {
      const today = new Date()

      const result = validateStudentBirthday(today)
      expect(result).toBe('validationError')
    })

    it('should return OK for birth date far in the past', () => {
      const birthDate = new Date('2000-01-01')

      const result = validateStudentBirthday(birthDate)
      expect(result).toBe('OK')
    })

    it('should return validationError for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const result = validateStudentBirthday(tomorrow)
      expect(result).toBe('validationError')
    })

    it('should handle edge case of one millisecond in future', () => {
      const now = new Date()
      const almostFuture = new Date(now.getTime() + 1)

      const result = validateStudentBirthday(almostFuture)
      expect(result).toBe('validationError')
    })

    it('should handle edge case of one millisecond in past', () => {
      const now = new Date()
      const almostPast = new Date(now.getTime() - 1)

      const result = validateStudentBirthday(almostPast)
      expect(result).toBe('OK')
    })
  })
})
