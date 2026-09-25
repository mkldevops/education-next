import { describe, expect, it } from 'vitest'
import { isGmailAddress, resolveSignInUpgradeOffer } from '../sign-in-upgrade'

const base = {
  email: 'parent@gmail.com',
  hasGoogleAccount: false,
  passkeyCount: 0,
  dismissedAt: null,
  googleAvailable: true,
  passkeyEnabled: true,
}

describe('isGmailAddress', () => {
  it('matches a gmail.com address regardless of casing', () => {
    expect(isGmailAddress('Parent@Gmail.com')).toBe(true)
  })

  it('does not match googlemail.com, Workspace domains or a lookalike suffix', () => {
    expect(isGmailAddress('parent@googlemail.com')).toBe(false)
    expect(isGmailAddress('parent@school.test')).toBe(false)
    expect(isGmailAddress('parent@notgmail.com')).toBe(false)
    expect(isGmailAddress('parent@gmail.com.evil.test')).toBe(false)
  })
})

describe('resolveSignInUpgradeOffer option selection', () => {
  it('offers Google and a passkey to a gmail.com address', () => {
    expect(resolveSignInUpgradeOffer(base)).toEqual({ google: true, passkey: true })
  })

  it('offers only a passkey to any other address', () => {
    expect(resolveSignInUpgradeOffer({ ...base, email: 'parent@school.test' })).toEqual({
      google: false,
      passkey: true,
    })
  })

  it('drops Google when the platform cannot offer it, even for a gmail.com address', () => {
    expect(resolveSignInUpgradeOffer({ ...base, googleAvailable: false })).toEqual({
      google: false,
      passkey: true,
    })
  })

  it('drops the passkey when registration is closed on the platform', () => {
    expect(resolveSignInUpgradeOffer({ ...base, passkeyEnabled: false })).toEqual({
      google: true,
      passkey: false,
    })
  })

  it('offers nothing when neither method can be proposed', () => {
    expect(
      resolveSignInUpgradeOffer({ ...base, email: 'parent@school.test', passkeyEnabled: false })
    ).toBeNull()
  })
})

describe('resolveSignInUpgradeOffer display conditions', () => {
  it('is silent once the user dismissed it', () => {
    expect(resolveSignInUpgradeOffer({ ...base, dismissedAt: new Date('2026-09-01') })).toBeNull()
  })

  it('is silent when a Google account is already linked', () => {
    expect(resolveSignInUpgradeOffer({ ...base, hasGoogleAccount: true })).toBeNull()
  })

  it('is silent when the user already owns a passkey', () => {
    expect(resolveSignInUpgradeOffer({ ...base, passkeyCount: 1 })).toBeNull()
  })
})
