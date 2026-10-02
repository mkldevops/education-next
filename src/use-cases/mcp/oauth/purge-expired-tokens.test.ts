import { describe, expect, it, vi } from 'vitest'
import { purgeExpiredOAuthTokens } from './purge-expired-tokens'

const purgeExpiredTokens = vi.fn(async () => 3)
const purgeUnused = vi.fn(async () => 2)
const gateways = { grantGw: { purgeExpiredTokens }, clientGw: { purgeUnused } }

describe('purgeExpiredOAuthTokens', () => {
  it('purges expired secrets and day-old clients without any connection, then throttles', async () => {
    const now = new Date('2026-10-02T10:00:00Z')

    expect(await purgeExpiredOAuthTokens(now, gateways)).toEqual({ tokens: 3, clients: 2 })
    expect(purgeExpiredTokens).toHaveBeenCalledWith(now)
    expect(purgeUnused).toHaveBeenCalledWith(new Date('2026-10-01T10:00:00Z'))

    expect(await purgeExpiredOAuthTokens(new Date('2026-10-02T10:00:01Z'), gateways)).toBe(
      'skipped'
    )
    expect(purgeUnused).toHaveBeenCalledTimes(1)
  })
})
