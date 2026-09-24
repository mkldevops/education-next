import { describe, expect, it } from 'vitest'
import { matchesQuery, resolvePaletteActions } from '../palette-actions'
import { isApplePlatform } from '../shortcut'
import type { NavScope } from '../sidebar-items'

const scope = (overrides: Partial<NavScope> = {}): NavScope => ({
  role: 'ADMIN',
  isSuperAdmin: false,
  features: { events: false, payments: true, attendance: true },
  ...overrides,
})

const keys = (value: NavScope) => resolvePaletteActions(value).map((action) => action.key)

describe('resolvePaletteActions', () => {
  it('offers every shortcut to an admin with payments and attendance enabled', () => {
    expect(keys(scope())).toEqual([
      'newFamily',
      'newEnrollment',
      'takeAttendance',
      'reviewBalances',
    ])
  })

  it('drops the shortcuts of disabled modules', () => {
    expect(
      keys(scope({ features: { events: false, payments: false, attendance: false } }))
    ).toEqual(['newFamily', 'newEnrollment'])
  })

  it('never offers management shortcuts to a parent', () => {
    expect(keys(scope({ role: 'PARENT', familyId: 'family-1' }))).not.toContain('newFamily')
    expect(keys(scope({ role: 'PARENT', familyId: 'family-1' }))).not.toContain('reviewBalances')
  })
})

describe('matchesQuery', () => {
  it('ignores case and accents', () => {
    expect(matchesQuery('Élèves', 'eleves')).toBe(true)
    expect(matchesQuery('Paiements', 'PAIE')).toBe(true)
    expect(matchesQuery('Familles', 'classe')).toBe(false)
    expect(matchesQuery('Familles', '  ')).toBe(true)
  })
})

describe('isApplePlatform', () => {
  it('detects Apple devices for the ⌘ label and falls back to Ctrl elsewhere', () => {
    expect(isApplePlatform({ userAgentData: { platform: 'macOS' } })).toBe(true)
    expect(isApplePlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isApplePlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0)' })).toBe(true)
    expect(isApplePlatform({ platform: 'Win32' })).toBe(false)
    expect(isApplePlatform({ userAgentData: { platform: 'Linux' } })).toBe(false)
    expect(isApplePlatform({})).toBe(false)
  })
})
