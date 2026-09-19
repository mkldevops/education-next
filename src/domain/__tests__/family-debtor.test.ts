import { describe, expect, it } from 'vitest'
import { resolveDebtorFamily } from '../family-debtor'

describe('resolveDebtorFamily', () => {
  it('returns null without any family', () => {
    expect(resolveDebtorFamily([])).toBeNull()
  })

  it('keeps the only family when there is one', () => {
    const families = [{ familyId: 'family-1', relationType: 'OTHER' as const }]

    expect(resolveDebtorFamily(families)).toBe(families[0])
  })

  it('prefers a parent over a tutor regardless of order', () => {
    const parent = { familyId: 'family-b', relationType: 'PARENT' as const }
    const tutor = { familyId: 'family-a', relationType: 'TUTOR' as const }

    expect(resolveDebtorFamily([tutor, parent])).toBe(parent)
    expect(resolveDebtorFamily([parent, tutor])).toBe(parent)
  })

  it('ranks every relation type parent > tutor > grandparent > sibling > other', () => {
    const grandparent = { familyId: 'family-c', relationType: 'GRANDPARENT' as const }
    const sibling = { familyId: 'family-d', relationType: 'SIBLING' as const }
    const other = { familyId: 'family-e', relationType: 'OTHER' as const }
    const tutor = { familyId: 'family-b', relationType: 'TUTOR' as const }

    expect(resolveDebtorFamily([other, sibling, grandparent, tutor])).toBe(tutor)
    expect(resolveDebtorFamily([other, sibling, grandparent])).toBe(grandparent)
    expect(resolveDebtorFamily([other, sibling])).toBe(sibling)
  })

  it('breaks a tied priority by the lowest familyId, deterministically', () => {
    const first = { familyId: 'aaa', relationType: 'OTHER' as const }
    const second = { familyId: 'zzz', relationType: 'OTHER' as const }

    expect(resolveDebtorFamily([second, first])).toBe(first)
    expect(resolveDebtorFamily([first, second])).toBe(first)
  })
})
