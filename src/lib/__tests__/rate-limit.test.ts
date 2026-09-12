import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRateLimiter, getClientIp } from '../rate-limit'

describe('getClientIp', () => {
  const ipOf = (headers: Record<string, string>) =>
    getClientIp(new Request('http://localhost:8550/api/mcp', { headers }))

  it('keeps the first hop of a forwarded chain', () => {
    expect(ipOf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
  })

  it('falls back to the real-ip header, then to a constant bucket', () => {
    expect(ipOf({ 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7')
    expect(ipOf({ 'x-forwarded-for': '  ', 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7')
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
})
