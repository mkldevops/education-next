import { describe, expect, it } from 'vitest'
import {
  expiryFromDays,
  isKeyUsable,
  isWellFormedMcpKey,
  MCP_KEY_PREFIX,
  mcpKeyPrefix,
} from '../mcp-key'

const key = `${MCP_KEY_PREFIX}${'a'.repeat(43)}`

describe('isWellFormedMcpKey', () => {
  it('accepts the shape this repository issues', () => {
    expect(isWellFormedMcpKey(key)).toBe(true)
    expect(isWellFormedMcpKey(`${MCP_KEY_PREFIX}${'-_9Az'.repeat(8)}abc`)).toBe(true)
  })

  it('refuses anything that could not be one of our keys', () => {
    expect(isWellFormedMcpKey('')).toBe(false)
    expect(isWellFormedMcpKey('edu_mcp_')).toBe(false)
    expect(isWellFormedMcpKey(`${MCP_KEY_PREFIX}${'a'.repeat(42)}`)).toBe(false)
    expect(isWellFormedMcpKey(`${MCP_KEY_PREFIX}${'a'.repeat(44)}`)).toBe(false)
    expect(isWellFormedMcpKey(`sk_live_${'a'.repeat(43)}`)).toBe(false)
    expect(isWellFormedMcpKey(`${MCP_KEY_PREFIX}${'a'.repeat(42)}+`)).toBe(false)
    expect(isWellFormedMcpKey(` ${key}`)).toBe(false)
  })
})

describe('mcpKeyPrefix', () => {
  it('keeps enough to recognise a key without exposing its secret', () => {
    expect(mcpKeyPrefix(key)).toBe('edu_mcp_aaaa')
    expect(mcpKeyPrefix(key).length).toBeLessThan(key.length)
  })
})

describe('isKeyUsable', () => {
  const now = new Date('2026-09-11T12:00:00Z')

  it('accepts a live key', () => {
    expect(isKeyUsable({ revokedAt: null, expiresAt: new Date('2026-12-01') }, now)).toBe(true)
  })

  it('refuses a revoked key even when it has not expired', () => {
    expect(
      isKeyUsable({ revokedAt: new Date('2026-09-01'), expiresAt: new Date('2026-12-01') }, now)
    ).toBe(false)
  })

  it('refuses an expired key, boundary included', () => {
    expect(isKeyUsable({ revokedAt: null, expiresAt: new Date('2026-09-01') }, now)).toBe(false)
    expect(isKeyUsable({ revokedAt: null, expiresAt: now }, now)).toBe(false)
  })
})

describe('expiryFromDays', () => {
  it('adds the requested days to the reference instant', () => {
    const now = new Date('2026-09-11T12:00:00Z')

    expect(expiryFromDays(90, now).toISOString()).toBe('2026-12-10T12:00:00.000Z')
  })
})
