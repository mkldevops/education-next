import { describe, expect, it } from 'vitest'
import {
  committedRetentionBefore,
  draftExpiry,
  isDraftUsable,
  MCP_DRAFT_COMMIT_TIMEOUT_SECONDS,
  MCP_DRAFT_COMMITTED_RETENTION_DAYS,
  MCP_DRAFT_TTL_MINUTES,
  ownerColumns,
  ownsDraft,
  staleCommitBefore,
} from '../mcp-draft'

const now = new Date('2026-09-12T10:00:00.000Z')

describe('draftExpiry', () => {
  it('pushes the deadline by the published time to live', () => {
    expect(draftExpiry(now).getTime() - now.getTime()).toBe(MCP_DRAFT_TTL_MINUTES * 60 * 1000)
  })
})

describe('isDraftUsable', () => {
  it('accepts a pending draft that has not run out', () => {
    expect(isDraftUsable({ status: 'PENDING', expiresAt: draftExpiry(now) }, now)).toBe(true)
  })

  it('refuses a draft that is already committed, whatever its deadline', () => {
    expect(isDraftUsable({ status: 'COMMITTED', expiresAt: draftExpiry(now) }, now)).toBe(false)
  })

  it('refuses a draft whose deadline has passed', () => {
    const expired = new Date(now.getTime() - 1)

    expect(isDraftUsable({ status: 'PENDING', expiresAt: expired }, now)).toBe(false)
  })

  it('refuses a draft expiring on the very instant it is read', () => {
    expect(isDraftUsable({ status: 'PENDING', expiresAt: now }, now)).toBe(false)
  })
})

describe('staleCommitBefore', () => {
  it('holds a commit for the published abandon delay before it can be taken over', () => {
    expect(now.getTime() - staleCommitBefore(now).getTime()).toBe(
      MCP_DRAFT_COMMIT_TIMEOUT_SECONDS * 1000
    )
  })

  it('stays far shorter than the draft time to live, which it must not outlive', () => {
    expect(MCP_DRAFT_COMMIT_TIMEOUT_SECONDS).toBeLessThan(MCP_DRAFT_TTL_MINUTES * 60)
  })
})

describe('committedRetentionBefore', () => {
  it('keeps a committed draft for the published retention, counted from its expiry', () => {
    expect(now.getTime() - committedRetentionBefore(now).getTime()).toBe(
      MCP_DRAFT_COMMITTED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    )
  })

  it('outlives the draft time to live, so a late replay still finds its recorded result', () => {
    expect(now.getTime() - committedRetentionBefore(now).getTime()).toBeGreaterThan(
      MCP_DRAFT_TTL_MINUTES * 60 * 1000
    )
  })
})

describe('ownerColumns', () => {
  it('spreads an MCP key owner onto the key column only', () => {
    expect(ownerColumns({ kind: 'MCP_KEY', keyId: 'key-1' })).toEqual({
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
    })
  })

  it('spreads an admin session owner onto the user column only', () => {
    expect(ownerColumns({ kind: 'ADMIN_SESSION', userId: 'user-1' })).toEqual({
      ownerKind: 'ADMIN_SESSION',
      keyId: null,
      userId: 'user-1',
    })
  })
})

describe('ownsDraft', () => {
  const byKey = { ownerKind: 'MCP_KEY' as const, keyId: 'key-1', userId: null }
  const bySession = { ownerKind: 'ADMIN_SESSION' as const, keyId: null, userId: 'user-1' }

  it('matches the same owner in the same access mode', () => {
    expect(ownsDraft(byKey, { kind: 'MCP_KEY', keyId: 'key-1' })).toBe(true)
    expect(ownsDraft(bySession, { kind: 'ADMIN_SESSION', userId: 'user-1' })).toBe(true)
  })

  it('refuses another key or another user', () => {
    expect(ownsDraft(byKey, { kind: 'MCP_KEY', keyId: 'key-2' })).toBe(false)
    expect(ownsDraft(bySession, { kind: 'ADMIN_SESSION', userId: 'user-2' })).toBe(false)
  })

  it('never crosses access modes, even for the same user', () => {
    expect(ownsDraft(bySession, { kind: 'MCP_KEY', keyId: 'key-1' })).toBe(false)
    expect(ownsDraft(byKey, { kind: 'ADMIN_SESSION', userId: 'user-1' })).toBe(false)
  })
})
