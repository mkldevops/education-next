import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMcpOAuthGrants, revokeMcpOAuthGrant } from './grants'

const GRANT_ID = '7b1f3f8e-2c6d-4a1e-9f0b-5d4c3b2a1e0f'

const listForUser = vi.fn()
const revokeForUser = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  listForUser.mockResolvedValue([{ id: GRANT_ID }])
  revokeForUser.mockResolvedValue({ count: 1 })
})

describe('listMcpOAuthGrants', () => {
  it('lists the grants of the user on the active school only', async () => {
    expect(await listMcpOAuthGrants('user-1', 'school-1', { listForUser })).toEqual([
      { id: GRANT_ID },
    ])
    expect(listForUser).toHaveBeenCalledWith('user-1', 'school-1')
  })
})

describe('revokeMcpOAuthGrant', () => {
  it('revokes through the user and school filters', async () => {
    expect(await revokeMcpOAuthGrant(GRANT_ID, 'user-1', 'school-1', { revokeForUser })).toBe('OK')
    expect(revokeForUser).toHaveBeenCalledWith(GRANT_ID, 'user-1', 'school-1', expect.any(Date))
  })

  it("answers notFound for another user's grant or a malformed id", async () => {
    revokeForUser.mockResolvedValue({ count: 0 })
    expect(await revokeMcpOAuthGrant(GRANT_ID, 'user-2', 'school-1', { revokeForUser })).toBe(
      'notFound'
    )

    expect(await revokeMcpOAuthGrant('nope', 'user-1', 'school-1', { revokeForUser })).toBe(
      'notFound'
    )
    expect(revokeForUser).toHaveBeenCalledTimes(1)
  })
})
