import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revokeMcpApiKey } from './revoke-mcp-api-key'

const revoke = vi.fn()
const keyGw = { revoke }

const id = '6d3c7f9e-2f3a-4c2b-9a1e-8b7d5c4f1a20'

beforeEach(() => {
  vi.clearAllMocks()
  revoke.mockResolvedValue({ count: 1 })
})

describe('revokeMcpApiKey', () => {
  it('revokes the key scoped on its holder and school', async () => {
    expect(await revokeMcpApiKey(id, 'user-1', 'school-1', keyGw)).toBe('OK')
    expect(revoke).toHaveBeenCalledWith(id, 'user-1', 'school-1', expect.any(Date))
  })

  it('refuses an identifier that is not a uuid before it reaches the filter', async () => {
    expect(await revokeMcpApiKey('', 'user-1', 'school-1', keyGw)).toBe('notFound')
    expect(
      await revokeMcpApiKey({ not: '' } as unknown as string, 'user-1', 'school-1', keyGw)
    ).toBe('notFound')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('reports a key it did not touch without saying which reason applied', async () => {
    revoke.mockResolvedValue({ count: 0 })

    expect(await revokeMcpApiKey(id, 'user-1', 'school-1', keyGw)).toBe('notFound')
  })
})
