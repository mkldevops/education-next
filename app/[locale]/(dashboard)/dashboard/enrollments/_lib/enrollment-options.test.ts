import { describe, expect, it } from 'vitest'
import { matchesStudent, rankClasses, remainingSeats, suggestLevelId } from './enrollment-options'

describe('suggestLevelId', () => {
  const last = { levelId: 'ce1', nextLevelId: 'ce2', periodId: 'p-2025' }

  it('keeps the level of an assignment already on the target period', () => {
    expect(suggestLevelId(last, 'p-2025')).toBe('ce1')
  })

  it('moves to the next level from an earlier period', () => {
    expect(suggestLevelId(last, 'p-2026')).toBe('ce2')
  })

  it('stays on the last level at the end of the progression', () => {
    expect(suggestLevelId({ ...last, nextLevelId: null }, 'p-2026')).toBe('ce1')
  })

  it('suggests nothing without history', () => {
    expect(suggestLevelId(null, 'p-2026')).toBeNull()
  })
})

describe('rankClasses', () => {
  const classes = [
    { id: 'a', name: 'CE1-A', levelId: 'ce1', capacity: 18, enrolled: 18 },
    { id: 'b', name: 'CE1-B', levelId: 'ce1', capacity: 18, enrolled: 16 },
    { id: 'c', name: 'CP', levelId: 'cp', capacity: 18, enrolled: 3 },
  ]

  it('puts the suggested level first, full classes last within each group', () => {
    const { suggested, others } = rankClasses(classes, 'ce1')
    expect(suggested.map((c) => c.id)).toEqual(['b', 'a'])
    expect(others.map((c) => c.id)).toEqual(['c'])
  })

  it('keeps every class in one group without suggestion', () => {
    const { suggested, others } = rankClasses(classes, null)
    expect(suggested).toEqual([])
    expect(others.map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('remainingSeats', () => {
  it('returns the free seats, never below zero', () => {
    expect(remainingSeats({ id: 'a', name: 'A', capacity: 18, enrolled: 16 })).toBe(2)
    expect(remainingSeats({ id: 'a', name: 'A', capacity: 18, enrolled: 20 })).toBe(0)
  })

  it('is unknown without capacity data', () => {
    expect(remainingSeats({ id: 'a', name: 'A' })).toBeNull()
  })
})

describe('matchesStudent', () => {
  const alice = { id: 's1', name: 'Alice Martin', familyName: 'Famille Lefèvre' }

  it('matches the student or family name, ignoring case and accents', () => {
    expect(matchesStudent(alice, 'alice')).toBe(true)
    expect(matchesStudent(alice, 'lefevre')).toBe(true)
    expect(matchesStudent(alice, 'dupont')).toBe(false)
  })
})
