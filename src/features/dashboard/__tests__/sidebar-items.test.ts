import { describe, expect, it } from 'vitest'
import { resolveNavItems } from '../sidebar-items'

const keys = (items: { key: string }[]) => items.map((item) => item.key)

describe('resolveNavItems', () => {
  it('hides admin-only configuration from a caller without a school role', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: false, features: { events: false } })

    expect(items.config).toEqual([])
    expect(keys(items.gestion)).toContain('payments')
  })

  it('exposes configuration to an admin of the school, minus the platform pages', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: false },
    })

    expect(keys(items.config)).toEqual([
      'periods',
      'levels',
      'classes',
      'teachers',
      'plans',
      'config',
      'users',
    ])
    expect(keys(items.config)).not.toContain('schools')
    expect(keys(items.config)).not.toContain('superAdmins')
    expect(keys(items.config)).toContain('config')
  })

  it('exposes the platform pages to a super admin only', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: true, features: { events: false } })

    expect(keys(items.config)).toContain('schools')
    expect(items.config.find((item) => item.key === 'schools')?.href).toBe('/dashboard/schools')
    expect(items.config.find((item) => item.key === 'superAdmins')?.href).toBe(
      '/dashboard/super-admins'
    )
  })

  it('hides the platform pages from a parent who is not a super admin', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: false },
    })

    expect(keys(items.config)).not.toContain('schools')
    expect(keys(items.config)).not.toContain('superAdmins')
    expect(keys(items.config)).not.toContain('config')
  })

  it('points a parent at their own family and drops the management pages', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: false },
    })

    expect(keys(items.gestion)).toEqual(['dashboard', 'myFamily'])
    expect(items.gestion[1].href).toBe('/dashboard/families/family-1')
    expect(keys(items.bottom)).toEqual(['profile'])
  })

  it('falls back to the families list when a parent has no linked family', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      features: { events: false },
    })

    expect(items.gestion[1].href).toBe('/dashboard/families')
  })

  it('shows the events entry to an admin only when the feature flag is enabled', () => {
    const enabled = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: true },
    })
    const disabled = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: false },
    })

    expect(keys(enabled.gestion)).toContain('events')
    expect(keys(disabled.gestion)).not.toContain('events')
  })

  it('hides the events entry from a super admin when the feature flag is disabled', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: true, features: { events: false } })

    expect(keys(items.gestion)).not.toContain('events')
  })

  it('hides the events entry from a parent even when the feature flag is enabled', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: true },
    })

    expect(keys(items.gestion)).not.toContain('events')
  })
})
