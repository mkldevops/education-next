import { describe, expect, it } from 'vitest'
import { schoolSwitchLanding } from '../school-switch-landing'

describe('schoolSwitchLanding', () => {
  it('remonte à la liste de la section depuis une page de détail', () => {
    expect(schoolSwitchLanding('/dashboard/families/abc')).toBe('/dashboard/families')
    expect(schoolSwitchLanding('/dashboard/students/abc')).toBe('/dashboard/students')
  })

  it('laisse en place une page de section', () => {
    expect(schoolSwitchLanding('/dashboard/families')).toBe('/dashboard/families')
    expect(schoolSwitchLanding('/dashboard')).toBe('/dashboard')
  })

  it('laisse en place les pages hors tableau de bord', () => {
    expect(schoolSwitchLanding('/profile')).toBe('/profile')
    expect(schoolSwitchLanding('/settings')).toBe('/settings')
  })
})
