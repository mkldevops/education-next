import { describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import fr from '../../../../messages/fr.json'
import {
  flattenNavItems,
  type NavSectionKey,
  resolveNavItems,
  type VisibleNavItems,
} from '../sidebar-items'

const keys = (items: { key: string }[]) => items.map((item) => item.key)
const all = (items: VisibleNavItems) => flattenNavItems(items)
const group = (items: VisibleNavItems, key: NavSectionKey) =>
  items.sections.find((section) => section.key === key)?.items ?? []
const find = (items: VisibleNavItems, key: string) => all(items).find((item) => item.key === key)

describe('resolveNavItems', () => {
  it('translates the attendance navigation entry in every locale', () => {
    expect(fr.dashboard.sidebar.attendance).toBe('Suivi des appels')
    expect(en.dashboard.sidebar.attendance).toBe('Attendance tracking')
  })

  it('shows attendance only when enabled for an admin and teacher', () => {
    const admin = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: false, payments: true, attendance: true },
    })
    const teacher = resolveNavItems({
      role: 'TEACHER',
      isSuperAdmin: false,
      features: { events: false, payments: true, attendance: true },
    })
    const disabled = resolveNavItems({
      role: 'TEACHER',
      isSuperAdmin: false,
      features: { events: false, payments: true, attendance: false },
    })
    expect(keys(group(admin, 'today'))).toContain('attendance')
    expect(keys(group(teacher, 'teaching'))).toContain('attendance')
    expect(keys(all(disabled))).not.toContain('attendance')
  })
  it('hides admin-only configuration from a caller without a school role', () => {
    const items = resolveNavItems({
      role: null,
      isSuperAdmin: false,
      features: { events: false, payments: true },
    })

    expect(keys(items.sections)).toEqual(['today', 'schooling', 'finance'])
    expect(keys(all(items))).not.toContain('classes')
    expect(keys(all(items))).toContain('payments')
  })

  it('exposes configuration to an admin of the school, minus the platform pages', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: false, payments: true },
    })

    expect(keys(items.sections)).toEqual(['today', 'schooling', 'finance', 'settings'])
    expect(keys(group(items, 'settings'))).toEqual(['periods', 'levels', 'config', 'users'])
    expect(keys(group(items, 'schooling'))).toEqual([
      'families',
      'students',
      'enrollments',
      'classes',
      'teachers',
    ])
    expect(keys(group(items, 'finance'))).toEqual(['payments', 'plans'])
    expect(keys(all(items))).not.toContain('schools')
    expect(keys(all(items))).not.toContain('superAdmins')
  })

  it('exposes the platform pages to a super admin only', () => {
    const items = resolveNavItems({
      role: null,
      isSuperAdmin: true,
      features: { events: false, payments: true },
    })

    expect(keys(group(items, 'platform'))).toEqual(['schools', 'superAdmins'])
    expect(find(items, 'schools')?.href).toBe('/dashboard/schools')
    expect(find(items, 'superAdmins')?.href).toBe('/dashboard/super-admins')
  })

  it('hides the platform pages from a parent who is not a super admin', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: false, payments: true },
    })

    expect(keys(all(items))).not.toContain('schools')
    expect(keys(all(items))).not.toContain('superAdmins')
    expect(keys(all(items))).not.toContain('config')
  })

  it('points a parent at their own family and drops the management pages', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: false, payments: true },
    })

    expect(keys(items.sections)).toEqual(['family'])
    expect(keys(all(items))).toEqual(['dashboard', 'myFamily'])
    expect(find(items, 'myFamily')?.href).toBe('/dashboard/families/family-1')
    expect(keys(items.bottom)).toEqual(['profile'])
  })

  it('keeps a parent role while exposing their linked teacher classes', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      hasTeacherCapability: true,
      features: { events: false, payments: true },
    })

    expect(keys(all(items))).toEqual(['dashboard', 'myFamily', 'myClasses'])
  })

  it('keeps admin navigation and adds their linked teacher classes', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      hasTeacherCapability: true,
      features: { events: false, payments: true },
    })

    expect(keys(group(items, 'schooling'))).toContain('myClasses')
  })

  it('falls back to the families list when a parent has no linked family', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      features: { events: false, payments: true },
    })

    expect(find(items, 'myFamily')?.href).toBe('/dashboard/families')
  })

  it('shows the events entry to an admin only when the feature flag is enabled', () => {
    const enabled = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: true, payments: true },
    })
    const disabled = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: { events: false, payments: true },
    })

    expect(keys(all(enabled))).toContain('events')
    expect(keys(all(disabled))).not.toContain('events')
  })

  it('hides the events entry from a super admin when the feature flag is disabled', () => {
    const items = resolveNavItems({
      role: null,
      isSuperAdmin: true,
      features: { events: false, payments: true },
    })

    expect(keys(all(items))).not.toContain('events')
  })

  it('hides the events entry from a parent even when the feature flag is enabled', () => {
    const items = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      familyId: 'family-1',
      features: { events: true, payments: true },
    })

    expect(keys(all(items))).not.toContain('events')
  })
})

describe('resolveNavItems payments flag', () => {
  const scope = (payments: boolean) => ({ events: false, payments })

  it('shows payments and plans to an admin when payments are enabled', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: scope(true),
    })

    expect(keys(all(items))).toContain('payments')
    expect(keys(all(items))).toContain('plans')
  })

  it('hides payments and plans from an admin when payments are disabled', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: false,
      features: scope(false),
    })

    expect(keys(all(items))).not.toContain('payments')
    expect(keys(all(items))).not.toContain('plans')
  })

  it('shows payments and plans to a super admin when payments are enabled', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: true, features: scope(true) })

    expect(keys(all(items))).toContain('payments')
    expect(keys(all(items))).toContain('plans')
  })

  it('hides payments and plans from a super admin when payments are disabled', () => {
    const items = resolveNavItems({ role: null, isSuperAdmin: true, features: scope(false) })

    expect(keys(all(items))).not.toContain('payments')
    expect(keys(all(items))).not.toContain('plans')
  })

  it('never offers payments or plans to a parent, flag on or off', () => {
    const enabled = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      features: scope(true),
      familyId: 'family-1',
    })
    const disabled = resolveNavItems({
      role: 'PARENT',
      isSuperAdmin: false,
      features: scope(false),
      familyId: 'family-1',
    })

    for (const items of [enabled, disabled]) {
      expect(keys(all(items))).not.toContain('payments')
      expect(keys(all(items))).not.toContain('plans')
    }
  })
})

describe('resolveNavItems icons', () => {
  it('gives every visible entry a distinct icon', () => {
    const items = resolveNavItems({
      role: 'ADMIN',
      isSuperAdmin: true,
      hasTeacherCapability: true,
      features: { events: true, payments: true, attendance: true, classSchedule: true },
    })
    const icons = all(items).map((item) => item.icon)

    expect(new Set(icons).size).toBe(icons.length)
  })

  it('labels every section in every locale', () => {
    const sections: NavSectionKey[] = [
      'today',
      'schooling',
      'finance',
      'settings',
      'platform',
      'family',
      'teaching',
    ]
    for (const key of sections) {
      expect(fr.dashboard.sidebar.sections[key]).toBeTruthy()
      expect(en.dashboard.sidebar.sections[key]).toBeTruthy()
    }
  })
})
