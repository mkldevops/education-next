import { describe, expect, it } from 'vitest'
import { validateFamilyName } from '../family'

describe('family domain', () => {
  describe('validateFamilyName', () => {
    it('should return OK for valid name', () => {
      const result = validateFamilyName('Smith Family')
      expect(result).toBe('OK')
    })

    it('should return validationError for empty string', () => {
      const result = validateFamilyName('')
      expect(result).toBe('validationError')
    })

    it('should return validationError for whitespace-only string', () => {
      const result = validateFamilyName('   ')
      expect(result).toBe('validationError')
    })

    it('should return validationError for name exceeding 50 characters', () => {
      const result = validateFamilyName('a'.repeat(51))
      expect(result).toBe('validationError')
    })

    it('should return OK for name exactly 50 characters', () => {
      const result = validateFamilyName('a'.repeat(50))
      expect(result).toBe('OK')
    })

    it('should return OK for single character name', () => {
      const result = validateFamilyName('A')
      expect(result).toBe('OK')
    })

    it('should return OK for name with special characters', () => {
      const result = validateFamilyName("O'Brien")
      expect(result).toBe('OK')
    })

    it('should return validationError for name with only tabs and spaces', () => {
      const result = validateFamilyName('\t \t')
      expect(result).toBe('validationError')
    })
  })
})
