import { describe, expect, it } from 'vitest'
import { cn } from '../utils'

describe('utils', () => {
  describe('cn function', () => {
    it('should merge simple class names', () => {
      const result = cn('px-2', 'py-1')

      expect(result).toBe('px-2 py-1')
    })

    it('should handle undefined values', () => {
      const result = cn('px-2', undefined, 'py-1')

      expect(result).toBe('px-2 py-1')
    })

    it('should handle null values', () => {
      const result = cn('px-2', null, 'py-1')

      expect(result).toBe('px-2 py-1')
    })

    it('should handle false values', () => {
      const result = cn('px-2', false && 'hidden', 'py-1')

      expect(result).toBe('px-2 py-1')
    })

    it('should handle conditional classes with object', () => {
      const result = cn('px-2', {
        'text-red-500': true,
        'text-blue-500': false,
      })

      expect(result).toContain('px-2')
      expect(result).toContain('text-red-500')
      expect(result).not.toContain('text-blue-500')
    })

    it('should handle array of classes', () => {
      const result = cn(['px-2', 'py-1'])

      expect(result).toBe('px-2 py-1')
    })

    it('should deduplicate tailwind conflicting classes', () => {
      const result = cn('px-2', 'px-4')

      expect(result).toContain('px-4')
      expect(result).not.toContain('px-2')
    })

    it('should handle padding conflicts correctly', () => {
      const result = cn('p-2', 'p-4')

      expect(result).toContain('p-4')
    })

    it('should handle text color conflicts correctly', () => {
      const result = cn('text-blue-500', 'text-red-500')

      expect(result).toContain('text-red-500')
    })

    it('should handle background color conflicts correctly', () => {
      const result = cn('bg-blue-500', 'bg-red-500')

      expect(result).toContain('bg-red-500')
    })

    it('should preserve non-conflicting classes', () => {
      const result = cn('px-2 py-4', 'rounded-lg')

      expect(result).toContain('px-2')
      expect(result).toContain('py-4')
      expect(result).toContain('rounded-lg')
    })

    it('should handle complex nested conditions', () => {
      const isActive = true
      const isDisabled = false

      const result = cn('base-class', isActive && 'active-class', isDisabled && 'disabled-class')

      expect(result).toContain('base-class')
      expect(result).toContain('active-class')
      expect(result).not.toContain('disabled-class')
    })

    it('should handle empty string', () => {
      const result = cn('px-2', '', 'py-1')

      expect(result).toBe('px-2 py-1')
    })

    it('should return empty string when no classes provided', () => {
      const result = cn()

      expect(result).toBe('')
    })

    it('should handle whitespace in class names', () => {
      const result = cn('  px-2  ', 'py-1')

      expect(result).toContain('px-2')
      expect(result).toContain('py-1')
    })
  })
})
