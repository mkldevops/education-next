import { describe, expect, it } from 'vitest'
import type { DeactivationBlockers } from '@/domain/school-deactivation'
import { classifySchoolDeactivation } from '@/domain/school-deactivation'

const NO_BLOCKER: DeactivationBlockers = {
  pendingEnrollments: 0,
  pendingTransactions: 0,
  pendingInvitations: 0,
}

describe('classifySchoolDeactivation', () => {
  it('allows the deactivation when another school stays active and nothing blocks', () => {
    expect(classifySchoolDeactivation(2, NO_BLOCKER)).toEqual({ status: 'OK' })
  })

  it('refuses to deactivate the last active school', () => {
    expect(classifySchoolDeactivation(1, NO_BLOCKER)).toEqual({ status: 'lastActiveSchool' })
  })

  it('refuses to deactivate the last active school even when nothing else blocks', () => {
    expect(classifySchoolDeactivation(0, NO_BLOCKER)).toEqual({ status: 'lastActiveSchool' })
  })

  it('reports the lockout before the blockers, since it is the unrecoverable one', () => {
    expect(classifySchoolDeactivation(1, { ...NO_BLOCKER, pendingEnrollments: 3 })).toEqual({
      status: 'lastActiveSchool',
    })
  })

  it('enumerates pending enrollments', () => {
    expect(classifySchoolDeactivation(2, { ...NO_BLOCKER, pendingEnrollments: 3 })).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 3, pendingTransactions: 0, pendingInvitations: 0 },
    })
  })

  it('enumerates pending transactions', () => {
    expect(classifySchoolDeactivation(2, { ...NO_BLOCKER, pendingTransactions: 1 })).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 0, pendingTransactions: 1, pendingInvitations: 0 },
    })
  })

  it('enumerates unused invitations', () => {
    expect(classifySchoolDeactivation(2, { ...NO_BLOCKER, pendingInvitations: 2 })).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 0, pendingTransactions: 0, pendingInvitations: 2 },
    })
  })

  it('enumerates every blocker at once rather than stopping at the first', () => {
    expect(
      classifySchoolDeactivation(2, {
        pendingEnrollments: 1,
        pendingTransactions: 2,
        pendingInvitations: 3,
      })
    ).toEqual({
      status: 'schoolInUse',
      blockers: { pendingEnrollments: 1, pendingTransactions: 2, pendingInvitations: 3 },
    })
  })
})
