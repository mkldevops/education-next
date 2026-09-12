import { describe, expect, it } from 'vitest'
import { draftExpiry, isDraftUsable, MCP_DRAFT_TTL_MINUTES } from '../mcp-draft'

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
