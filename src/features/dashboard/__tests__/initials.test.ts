import { describe, expect, it } from 'vitest'
import { toInitials } from '../initials'

describe('toInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(toInitials('Msadawaheri Marseille')).toBe('MM')
  })

  it('keeps accented letters', () => {
    expect(toInitials('École Al-Nour')).toBe('ÉA')
  })

  it('splits on hyphens as well as spaces', () => {
    expect(toInitials('Al-Nour')).toBe('AN')
  })

  it('ignores extra words beyond the first two', () => {
    expect(toInitials('Association École Al Nour de Paris')).toBe('AÉ')
  })

  it('falls back to a single letter for a one-word name', () => {
    expect(toInitials('Montessori')).toBe('M')
  })

  it('skips words that start with a non-letter', () => {
    expect(toInitials('123 Montessori')).toBe('M')
  })

  it('returns a placeholder rather than an empty badge', () => {
    expect(toInitials('   ')).toBe('?')
    expect(toInitials('123 456')).toBe('?')
  })
})
