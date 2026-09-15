import { describe, expect, it } from 'vitest'
import { readsAsEnabled, readsAsOptedIn } from '../feature-flags'

describe('readsAsEnabled', () => {
  it('reads an absent setting as enabled', () => {
    expect(readsAsEnabled(undefined)).toBe(true)
    expect(readsAsEnabled(null)).toBe(true)
  })

  it('reads an explicit false as disabled', () => {
    expect(readsAsEnabled('false')).toBe(false)
  })

  it('reads an explicit true as enabled', () => {
    expect(readsAsEnabled('true')).toBe(true)
  })

  it('reads an unexpected value as enabled rather than silently disabling', () => {
    expect(readsAsEnabled('')).toBe(true)
    expect(readsAsEnabled('nope')).toBe(true)
  })

  it('honours a refusal written in another casing or spelling', () => {
    expect(readsAsEnabled('FALSE')).toBe(false)
    expect(readsAsEnabled(' false ')).toBe(false)
    expect(readsAsEnabled('0')).toBe(false)
    expect(readsAsEnabled('Off')).toBe(false)
    expect(readsAsEnabled('no')).toBe(false)
  })
})

describe('readsAsOptedIn', () => {
  it('reads an absent setting as disabled, so a write API never opens itself', () => {
    expect(readsAsOptedIn(undefined)).toBe(false)
    expect(readsAsOptedIn(null)).toBe(false)
  })

  it('opens only on an affirmative value', () => {
    expect(readsAsOptedIn('true')).toBe(true)
    expect(readsAsOptedIn('TRUE')).toBe(true)
    expect(readsAsOptedIn(' 1 ')).toBe(true)
    expect(readsAsOptedIn('on')).toBe(true)
    expect(readsAsOptedIn('yes')).toBe(true)
  })

  it('keeps an unreadable value closed', () => {
    expect(readsAsOptedIn('')).toBe(false)
    expect(readsAsOptedIn('nope')).toBe(false)
    expect(readsAsOptedIn('false')).toBe(false)
  })
})
