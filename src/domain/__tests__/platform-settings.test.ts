import { describe, expect, it } from 'vitest'
import { readsAsEnabled, SCHOOL_SWITCH_SETTING } from '../platform-settings'

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

describe('SCHOOL_SWITCH_SETTING', () => {
  it('names the platform flag governing the school switch', () => {
    expect(SCHOOL_SWITCH_SETTING).toBe('school_switch_enabled')
  })
})
