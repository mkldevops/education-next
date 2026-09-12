import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRateLimiter, getClientIp } from '../rate-limit'

describe('getClientIp', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const ipOf = (headers: Record<string, string>) =>
    getClientIp(new Request('http://localhost:8550/api/mcp', { headers }))

  it('reads the hop appended by the trusted proxy, not the client prefix', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', undefined)

    expect(ipOf({ 'x-forwarded-for': '203.0.113.7' })).toBe('203.0.113.7')
    expect(ipOf({ 'x-forwarded-for': '198.51.100.9, 203.0.113.7' })).toBe('203.0.113.7')
  })

  it('gives a rotating forged prefix the same bucket', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', undefined)

    const buckets = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((forged) =>
      ipOf({ 'x-forwarded-for': `${forged}, 203.0.113.7` })
    )

    expect(buckets).toEqual(['203.0.113.7', '203.0.113.7', '203.0.113.7'])
  })

  it('counts hops from the right and ignores empty entries', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')

    expect(ipOf({ 'x-forwarded-for': '198.51.100.9, 203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
    expect(ipOf({ 'x-forwarded-for': '198.51.100.9,  , 203.0.113.7 , 10.0.0.1' })).toBe(
      '203.0.113.7'
    )
  })

  it('refuses a chain shorter than the declared hops instead of trusting its prefix', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '3')

    expect(ipOf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('unknown')
  })

  it('reads the leftmost entry when the chain is exactly the declared hops', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')

    expect(ipOf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
  })

  it('trusts no forwarding header when no proxy is declared', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0')

    expect(ipOf({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.8' })).toBe('unknown')
  })

  it('falls back to one trusted hop when the setting is unusable', () => {
    for (const raw of ['', '  ', 'nonsense', '-1', '1.5', '1e1', '0x10', '99']) {
      vi.stubEnv('TRUSTED_PROXY_HOPS', raw)
      expect(ipOf({ 'x-forwarded-for': '198.51.100.9, 203.0.113.7' })).toBe('203.0.113.7')
    }
  })

  it('never derives the bucket from a header carrying no hop count', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', undefined)

    expect(ipOf({ 'x-real-ip': '203.0.113.7' })).toBe('unknown')
    expect(ipOf({ 'x-forwarded-for': '  ', 'x-real-ip': '203.0.113.7' })).toBe('unknown')
    expect(ipOf({})).toBe('unknown')
  })
})

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the budget then refuses', () => {
    const isRateLimited = createRateLimiter({ limit: 3, windowMs: 1000 })

    expect([1, 2, 3].map(() => isRateLimited('a'))).toEqual([false, false, false])
    expect(isRateLimited('a')).toBe(true)
  })

  it('counts each key separately', () => {
    const isRateLimited = createRateLimiter({ limit: 1, windowMs: 1000 })

    expect(isRateLimited('a')).toBe(false)
    expect(isRateLimited('b')).toBe(false)
    expect(isRateLimited('a')).toBe(true)
  })

  it('slides: a call leaving the window frees a slot', () => {
    const isRateLimited = createRateLimiter({ limit: 1, windowMs: 1000 })

    expect(isRateLimited('a')).toBe(false)
    vi.advanceTimersByTime(999)
    expect(isRateLimited('a')).toBe(true)
    vi.advanceTimersByTime(2)
    expect(isRateLimited('a')).toBe(false)
  })

  it('caps what it tracks so an unbounded key space cannot grow the map', () => {
    const isRateLimited = createRateLimiter({ limit: 1, windowMs: 60_000, maxTrackedKeys: 2 })

    isRateLimited('a')
    isRateLimited('b')
    isRateLimited('c')

    expect(isRateLimited('a')).toBe(false)
    expect(isRateLimited('c')).toBe(true)
  })

  it('refreshes a key on use, so eviction removes the least recently used', () => {
    const isRateLimited = createRateLimiter({ limit: 2, windowMs: 60_000, maxTrackedKeys: 2 })

    isRateLimited('established')
    isRateLimited('passing-by')
    isRateLimited('established')

    isRateLimited('fresh')

    expect(isRateLimited('established')).toBe(true)
  })

  it('keeps a refused key tracked so eviction cannot hand back its budget', () => {
    const isRateLimited = createRateLimiter({ limit: 1, windowMs: 60_000, maxTrackedKeys: 2 })

    isRateLimited('flooder')
    isRateLimited('other')
    expect(isRateLimited('flooder')).toBe(true)

    isRateLimited('fresh')

    expect(isRateLimited('flooder')).toBe(true)
  })
})
