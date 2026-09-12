import { describe, expect, it } from 'vitest'
import { resolveNavItems } from '../sidebar-items'

const keys = (items: { key: string }[]) => items.map((item) => item.key)

describe('resolveNavItems', () => {
  it('hides admin-only configuration from a caller without a school role', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: false })

    expect(items.config).toEqual([])
    expect(keys(items.gestion)).toContain('payments')
  })

  it('exposes configuration to an admin of the school, minus the platform pages', () => {
    const items = resolveNavItems({ role: 'ADMIN', isSuperAdmin: false })

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
    const items = resolveNavItems({ role: null, isSuperAdmin: true })

    expect(keys(items.config)).toContain('schools')
    expect(items.config.find((item) => item.key === 'schools')?.href).toBe('/dashboard/schools')
    expect(items.config.find((item) => item.key === 'superAdmins')?.href).toBe(
      '/dashboard/super-admins'
    )
  })

  it('hides the platform pages from a parent who is not a super admin', () => {
    const items = resolveNavItems({ role: 'PARENT', isSuperAdmin: false, familyId: 'family-1' })

    expect(keys(items.config)).not.toContain('schools')
    expect(keys(items.config)).not.toContain('superAdmins')
    expect(keys(items.config)).not.toContain('config')
  })

  it('points a parent at their own family and drops the management pages', () => {
    const items = resolveNavItems({ role: 'PARENT', isSuperAdmin: false, familyId: 'family-1' })

    expect(keys(items.gestion)).toEqual(['dashboard', 'myFamily'])
    expect(items.gestion[1].href).toBe('/dashboard/families/family-1')
    expect(keys(items.bottom)).toEqual(['profile'])
  })

  it('falls back to the families list when a parent has no linked family', () => {
    const items = resolveNavItems({ role: 'PARENT', isSuperAdmin: false })

    expect(items.gestion[1].href).toBe('/dashboard/families')
  })
})
