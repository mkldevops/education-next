import { describe, expect, it, vi } from 'vitest'
import { checkCircularReference } from '../level'

function graph(edges: Record<string, string[]>) {
  return vi.fn((id: string) => edges[id] ?? [])
}

describe('level domain', () => {
  describe('checkCircularReference', () => {
    it('refuses a level as its own next level', () => {
      const getNextLevelIds = graph({})

      expect(checkCircularReference('level1', ['level1'], getNextLevelIds)).toBe(
        'circularReference'
      )
      expect(getNextLevelIds).not.toHaveBeenCalled()
    })

    it('refuses a link that closes a cycle through the chain', () => {
      const getNextLevelIds = graph({ level2: ['level3'], level3: ['level1'] })

      expect(checkCircularReference('level1', ['level2'], getNextLevelIds)).toBe(
        'circularReference'
      )
    })

    it('refuses a cycle reached through any of several branches', () => {
      const getNextLevelIds = graph({ level3: ['level4', 'level5'], level5: ['level1'] })

      expect(checkCircularReference('level1', ['level2', 'level3'], getNextLevelIds)).toBe(
        'circularReference'
      )
    })

    it('accepts a split progression without cycle', () => {
      const getNextLevelIds = graph({ level2: ['level4'], level3: ['level4'] })

      expect(checkCircularReference('level1', ['level2', 'level3'], getNextLevelIds)).toBe('OK')
    })

    it('visits a shared descendant once', () => {
      const getNextLevelIds = graph({ level2: ['level4'], level3: ['level4'], level4: [] })

      checkCircularReference('level1', ['level2', 'level3'], getNextLevelIds)

      expect(getNextLevelIds).toHaveBeenCalledTimes(3)
    })

    it('terminates on an existing cycle that does not involve the level', () => {
      const getNextLevelIds = graph({ level2: ['level3'], level3: ['level2'] })

      expect(checkCircularReference('level1', ['level2'], getNextLevelIds)).toBe('OK')
      expect(getNextLevelIds).toHaveBeenCalledTimes(2)
    })

    it('accepts an empty list of next levels', () => {
      expect(checkCircularReference('level1', [], graph({}))).toBe('OK')
    })
  })
})
