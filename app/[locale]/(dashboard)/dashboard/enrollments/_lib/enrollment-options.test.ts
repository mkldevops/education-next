import { describe, expect, it } from 'vitest'
import { matchesStudent } from './enrollment-options'

describe('matchesStudent', () => {
  const alice = { id: 's1', name: 'Alice Martin', familyName: 'Famille Lefèvre' }

  it('matches the student or family name, ignoring case and accents', () => {
    expect(matchesStudent(alice, 'alice')).toBe(true)
    expect(matchesStudent(alice, 'lefevre')).toBe(true)
    expect(matchesStudent(alice, 'dupont')).toBe(false)
  })
})
