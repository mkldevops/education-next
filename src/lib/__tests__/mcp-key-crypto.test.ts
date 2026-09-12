import { describe, expect, it } from 'vitest'
import { isWellFormedMcpKey } from '@/domain/mcp-key'
import { generateMcpKey, hashMcpKey } from '../mcp-key-crypto'

describe('generateMcpKey', () => {
  it('issues a key its own validator accepts', () => {
    expect(isWellFormedMcpKey(generateMcpKey())).toBe(true)
  })

  it('never repeats itself', () => {
    const keys = new Set(Array.from({ length: 64 }, generateMcpKey))

    expect(keys.size).toBe(64)
  })
})

describe('hashMcpKey', () => {
  it('is stable, so a presented key can be looked up by its hash', () => {
    const key = generateMcpKey()

    expect(hashMcpKey(key)).toBe(hashMcpKey(key))
  })

  it('produces a fixed-width hexadecimal digest', () => {
    expect(hashMcpKey(generateMcpKey())).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never returns the key itself', () => {
    const key = generateMcpKey()

    expect(hashMcpKey(key)).not.toContain(key.slice(8))
  })

  it('separates two keys that differ by one character', () => {
    const key = generateMcpKey()
    const twin = `${key.slice(0, -1)}${key.at(-1) === 'A' ? 'B' : 'A'}`

    expect(hashMcpKey(key)).not.toBe(hashMcpKey(twin))
  })
})
