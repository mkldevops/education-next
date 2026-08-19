import { describe, expect, it } from 'vitest'
import {
  type Actor,
  canAssignRole,
  checkDeactivation,
  checkDeletion,
  checkReactivation,
  checkRoleChange,
  isLastActiveSuperAdmin,
  type ManagedUser,
} from '../user'

const superAdmin: Actor = { id: 'actor-1', role: 'SUPER_ADMIN' }

function target(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return { id: 'target-1', role: 'PARENT', isActive: true, ...overrides }
}

describe('user domain', () => {
  describe('canAssignRole', () => {
    it('lets a super admin assign any role', () => {
      expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true)
      expect(canAssignRole('SUPER_ADMIN', 'PARENT')).toBe(true)
    })

    it('never lets an admin create a super admin', () => {
      expect(canAssignRole('ADMIN', 'SUPER_ADMIN')).toBe(false)
      expect(canAssignRole('ADMIN', 'ADMIN')).toBe(false)
      expect(canAssignRole('ADMIN', 'PARENT')).toBe(true)
    })
  })

  describe('isLastActiveSuperAdmin', () => {
    it('is true for the only active super admin', () => {
      expect(isLastActiveSuperAdmin(target({ role: 'SUPER_ADMIN' }), 1)).toBe(true)
    })

    it('is false when another active super admin remains', () => {
      expect(isLastActiveSuperAdmin(target({ role: 'SUPER_ADMIN' }), 2)).toBe(false)
    })

    it('is false for an inactive super admin', () => {
      expect(isLastActiveSuperAdmin(target({ role: 'SUPER_ADMIN', isActive: false }), 1)).toBe(
        false
      )
    })
  })

  describe('checkRoleChange', () => {
    it('rejects acting on yourself', () => {
      expect(checkRoleChange(superAdmin, target({ id: superAdmin.id }), 'PARENT', 3)).toBe(
        'cannotTargetSelf'
      )
    })

    it('rejects demoting the last super admin', () => {
      expect(checkRoleChange(superAdmin, target({ role: 'SUPER_ADMIN' }), 'ADMIN', 1)).toBe(
        'lastSuperAdmin'
      )
    })

    it('allows demoting a super admin when another one remains', () => {
      expect(checkRoleChange(superAdmin, target({ role: 'SUPER_ADMIN' }), 'ADMIN', 2)).toBe('OK')
    })

    it('allows promoting a parent', () => {
      expect(checkRoleChange(superAdmin, target(), 'ADMIN', 1)).toBe('OK')
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
      expect(checkDeactivation(superAdmin, target({ role: 'SUPER_ADMIN' }), 1)).toBe(
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
})
