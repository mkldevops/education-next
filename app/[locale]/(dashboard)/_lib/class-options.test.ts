import { describe, expect, it } from 'vitest'
import {
  classItemLabel,
  classLabel,
  groupClassesByLevel,
  rankClasses,
  remainingSeats,
  spansSeveralPeriods,
  suggestLevelId,
} from './class-options'

describe('suggestLevelId', () => {
  const last = { levelId: 'ce1', nextLevelIds: ['ce2'], periodId: 'p-2025' }

  it('keeps the level of an assignment already on the target period', () => {
    expect(suggestLevelId(last, 'p-2025')).toBe('ce1')
  })

  it('moves to the next level from an earlier period', () => {
    expect(suggestLevelId(last, 'p-2026')).toBe('ce2')
  })

  it('stays on the last level at the end of the progression', () => {
    expect(suggestLevelId({ ...last, nextLevelIds: [] }, 'p-2026')).toBe('ce1')
  })

  it('leaves the choice to the admin when the progression splits', () => {
    expect(suggestLevelId({ ...last, nextLevelIds: ['ce2', 'ce2-bis'] }, 'p-2026')).toBeNull()
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

describe('groupClassesByLevel', () => {
  it('groups classes by level name, full classes last within each level', () => {
    const groups = groupClassesByLevel([
      { id: 'a', name: 'CP-A', levelName: 'CP', capacity: 18, enrolled: 18 },
      { id: 'b', name: 'CE1', levelName: 'CE1', capacity: 18, enrolled: 2 },
      { id: 'c', name: 'CP-B', levelName: 'CP', capacity: 18, enrolled: 4 },
    ])
    expect(groups.map((g) => [g.levelName, g.classes.map((c) => c.id)])).toEqual([
      ['CE1', ['b']],
      ['CP', ['c', 'a']],
    ])
  })

  it('returns no group when a level name is missing', () => {
    expect(
      groupClassesByLevel([
        { id: 'a', name: 'A', levelName: 'CP' },
        { id: 'b', name: 'B' },
      ])
    ).toEqual([])
  })
})

describe('class labels', () => {
  const ce1 = { id: 'a', name: 'CE1-A', levelName: 'CE1', periodName: '2026-2027' }

  it('gives the full label for the trigger and the summaries', () => {
    expect(classLabel(ce1)).toBe('CE1-A (CE1 — 2026-2027)')
    expect(classLabel({ id: 'b', name: 'CP' })).toBe('CP')
  })

  it('drops the level under a level header and the period of a single period', () => {
    expect(classItemLabel(ce1, { showLevel: false, showPeriod: false })).toBe('CE1-A')
    expect(classItemLabel(ce1, { showLevel: true, showPeriod: false })).toBe('CE1-A (CE1)')
    expect(classItemLabel(ce1, { showLevel: false, showPeriod: true })).toBe('CE1-A (2026-2027)')
  })

  it('detects several periods among the offered classes', () => {
    expect(spansSeveralPeriods([ce1, { ...ce1, id: 'b' }])).toBe(false)
    expect(spansSeveralPeriods([ce1, { ...ce1, id: 'b', periodName: '2027-2028' }])).toBe(true)
  })
})
