import { describe, expect, it } from 'vitest'
import { checkCapacity, validateCapacityUpdate } from '../class-period'

describe('class-period domain', () => {
  describe('checkCapacity', () => {
    it('should return OK when enrolled is below capacity', () => {
      const result = checkCapacity(30, 20)
      expect(result).toBe('OK')
    })

    it('should return classFull when enrolled equals capacity', () => {
      const result = checkCapacity(30, 30)
      expect(result).toBe('classFull')
    })

    it('should return classFull when enrolled exceeds capacity', () => {
      const result = checkCapacity(30, 35)
      expect(result).toBe('classFull')
    })

    it('should return OK when capacity is one more than enrolled', () => {
      const result = checkCapacity(31, 30)
      expect(result).toBe('OK')
    })

    it('should handle zero enrolled students', () => {
      const result = checkCapacity(30, 0)
      expect(result).toBe('OK')
    })

    it('should handle full capacity with one student', () => {
      const result = checkCapacity(1, 1)
      expect(result).toBe('classFull')
    })
  })

  describe('validateCapacityUpdate', () => {
    it('should return OK when new capacity is above current enrolled', () => {
      const result = validateCapacityUpdate(40, 20)
      expect(result).toBe('OK')
    })

    it('should return OK when new capacity equals current enrolled', () => {
      const result = validateCapacityUpdate(20, 20)
      expect(result).toBe('OK')
    })

    it('should return capacityBelowEnrolled when new capacity is below current enrolled', () => {
      const result = validateCapacityUpdate(15, 20)
      expect(result).toBe('capacityBelowEnrolled')
    })

    it('should handle zero enrolled students', () => {
      const result = validateCapacityUpdate(30, 0)
      expect(result).toBe('OK')
    })

    it('should handle increasing capacity significantly', () => {
      const result = validateCapacityUpdate(100, 20)
      expect(result).toBe('OK')
    })

    it('should handle reducing capacity to enrolled count', () => {
      const result = validateCapacityUpdate(30, 30)
      expect(result).toBe('OK')
    })

    it('should reject any reduction below enrolled', () => {
      const result = validateCapacityUpdate(29, 30)
      expect(result).toBe('capacityBelowEnrolled')
    })
  })
})
