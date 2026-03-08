import { describe, expect, it, vi } from 'vitest'
import { checkCircularReference } from '../level'

describe('level domain', () => {
  describe('checkCircularReference', () => {
    it('should return circularReference when levelId equals nextLevelId', () => {
      const getNextLevel = vi.fn()

      const result = checkCircularReference('level1', 'level1', getNextLevel)

      expect(result).toBe('circularReference')
      expect(getNextLevel).not.toHaveBeenCalled()
    })

    it('should return circularReference for circular chain', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level1: 'level2',
          level2: 'level3',
          level3: 'level1',
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('circularReference')
    })

    it('should return OK when no circular reference exists', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level1: 'level2',
          level2: 'level3',
          level3: null,
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
    })

    it('should return OK for chain with visited detection preventing infinite loop', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level1: 'level2',
          level2: 'level3',
          level3: 'level2',
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
    })

    it('should handle chain that terminates with null', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level2: 'level3',
          level3: 'level4',
          level4: null,
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
    })

    it('should return circularReference when nextLevel points back to levelId', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level1: 'level2',
          level2: 'level1',
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('circularReference')
    })

    it('should track visited levels to prevent infinite loops', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level2: 'level3',
          level3: 'level2',
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
      expect(getNextLevel).toHaveBeenCalledTimes(2)
    })

    it('should return OK for single-level chain', () => {
      const getNextLevel = vi.fn((id: string) => null)

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
    })

    it('should return OK for long non-circular chain', () => {
      const getNextLevel = vi.fn((id: string) => {
        const chain: Record<string, string | null> = {
          level2: 'level3',
          level3: 'level4',
          level4: 'level5',
          level5: 'level6',
          level6: null,
        }
        return chain[id] ?? null
      })

      const result = checkCircularReference('level1', 'level2', getNextLevel)

      expect(result).toBe('OK')
    })
  })
})
