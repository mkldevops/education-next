import { describe, expect, it } from 'vitest'
import {
  type Actor,
  checkDeactivation,
  checkDeletion,
  checkImpersonation,
  checkPlatformLevelChange,
  checkReactivation,
  isImpersonating,
  isLastActiveSuperAdmin,
  type ManagedUser,
} from '../user'

const superAdmin: Actor = { id: 'actor-1' }

function target(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return { id: 'target-1', isSuperAdmin: false, isActive: true, ...overrides }
}

describe('user domain', () => {
  describe('isLastActiveSuperAdmin', () => {
    it('is true for the only active super admin', () => {
      expect(isLastActiveSuperAdmin(target({ isSuperAdmin: true }), 1)).toBe(true)
    })

    it('is false when another active super admin remains', () => {
      expect(isLastActiveSuperAdmin(target({ isSuperAdmin: true }), 2)).toBe(false)
    })

    it('is false for an inactive super admin', () => {
      expect(isLastActiveSuperAdmin(target({ isSuperAdmin: true, isActive: false }), 1)).toBe(false)
    })
  })

  describe('checkPlatformLevelChange', () => {
    it('rejects acting on yourself', () => {
      expect(checkPlatformLevelChange(superAdmin, target({ id: superAdmin.id }), false, 3)).toBe(
        'cannotTargetSelf'
      )
    })

    it('rejects removing the platform level from the last super admin', () => {
      expect(checkPlatformLevelChange(superAdmin, target({ isSuperAdmin: true }), false, 1)).toBe(
        'lastSuperAdmin'
      )
    })

    it('allows removing the platform level when another super admin remains', () => {
      expect(checkPlatformLevelChange(superAdmin, target({ isSuperAdmin: true }), false, 2)).toBe(
        'OK'
      )
    })

    it('allows granting the platform level', () => {
      expect(checkPlatformLevelChange(superAdmin, target(), true, 1)).toBe('OK')
    })
  })

  describe('checkDeactivation', () => {
    it('rejects acting on yourself', () => {
      expect(checkDeactivation(superAdmin, target({ id: superAdmin.id }), 3)).toBe(
        'cannotTargetSelf'
      )
    })

    it('rejects an already archived user', () => {
      expect(checkDeactivation(superAdmin, target({ isActive: false }), 3)).toBe('alreadyInactive')
    })

    it('rejects archiving the last super admin', () => {
      expect(checkDeactivation(superAdmin, target({ isSuperAdmin: true }), 1)).toBe(
        'lastSuperAdmin'
      )
    })

    it('allows archiving an ordinary user', () => {
      expect(checkDeactivation(superAdmin, target(), 1)).toBe('OK')
    })
  })

  describe('checkReactivation', () => {
    it('rejects acting on yourself', () => {
      expect(checkReactivation(superAdmin, target({ id: superAdmin.id, isActive: false }))).toBe(
        'cannotTargetSelf'
      )
    })

    it('rejects an already active user', () => {
      expect(checkReactivation(superAdmin, target())).toBe('alreadyActive')
    })

    it('allows restoring an archived user', () => {
      expect(checkReactivation(superAdmin, target({ isActive: false }))).toBe('OK')
    })
  })

  describe('checkDeletion', () => {
    it('rejects acting on yourself', () => {
      expect(checkDeletion(superAdmin, target({ id: superAdmin.id, isActive: false }), 0)).toBe(
        'cannotTargetSelf'
      )
    })

    it('requires the user to be archived first', () => {
      expect(checkDeletion(superAdmin, target(), 0)).toBe('stillActive')
    })

    it('rejects a user still referenced by history', () => {
      expect(checkDeletion(superAdmin, target({ isActive: false }), 2)).toBe('hasRelatedRecords')
    })

    it('allows deleting an archived user with no history', () => {
      expect(checkDeletion(superAdmin, target({ isActive: false }), 0)).toBe('OK')
    })
  })

  describe('checkImpersonation', () => {
    const actor = target({ id: superAdmin.id, isSuperAdmin: true })

    it('allows a super admin to impersonate an ordinary account', () => {
      expect(checkImpersonation(actor, target(), false)).toBe('OK')
    })

    it('rejects an actor without the platform level', () => {
      expect(checkImpersonation(target({ id: superAdmin.id }), target(), false)).toBe(
        'notSuperAdmin'
      )
    })

    it('rejects an archived super admin', () => {
      expect(checkImpersonation({ ...actor, isActive: false }, target(), false)).toBe(
        'notSuperAdmin'
      )
    })

    it('rejects a nested impersonation', () => {
      expect(checkImpersonation(actor, target(), true)).toBe('alreadyImpersonating')
    })

    it('rejects impersonating yourself', () => {
      expect(checkImpersonation(actor, actor, false)).toBe('cannotTargetSelf')
    })

    it('rejects impersonating another super admin', () => {
      expect(checkImpersonation(actor, target({ isSuperAdmin: true }), false)).toBe(
        'targetIsSuperAdmin'
      )
    })

    it('rejects impersonating an archived account', () => {
      expect(checkImpersonation(actor, target({ isActive: false }), false)).toBe('targetInactive')
    })
  })
})

describe('isImpersonating', () => {
  it('recognizes a borrowed session by its impersonatedBy', () => {
    expect(isImpersonating({ session: { impersonatedBy: 'admin-1' } })).toBe(true)
  })

  it('treats an ordinary or missing session as not borrowed', () => {
    expect(isImpersonating({ session: { impersonatedBy: null } })).toBe(false)
    expect(isImpersonating({ session: {} })).toBe(false)
    expect(isImpersonating({ session: { impersonatedBy: '' } })).toBe(false)
    expect(isImpersonating(null)).toBe(false)
    expect(isImpersonating(undefined)).toBe(false)
  })
})
