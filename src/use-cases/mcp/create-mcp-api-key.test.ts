import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isWellFormedMcpKey, MCP_KEY_MAX_PER_USER } from '@/domain/mcp-key'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { createMcpApiKey } from './create-mcp-api-key'

const createWithinLimit = vi.fn()
const keyGw = { createWithinLimit }

const input = {
  name: '  Poste de Fatima  ',
  lifetimeDays: 90,
  userId: 'user-1',
  schoolId: 'school-1',
}

const written = () => createWithinLimit.mock.calls[0][0]
const limit = () => createWithinLimit.mock.calls[0][1]

beforeEach(() => {
  vi.clearAllMocks()
  createWithinLimit.mockImplementation(async (data) => ({ id: 'key-1', ...data }))
})

describe('createMcpApiKey', () => {
  it('refuses a lifetime that is not one of the offered durations', async () => {
    expect(await createMcpApiKey({ ...input, lifetimeDays: 3650 }, keyGw)).toBe('validationError')
    expect(await createMcpApiKey({ ...input, name: '   ' }, keyGw)).toBe('validationError')
    expect(createWithinLimit).not.toHaveBeenCalled()
  })

  it('leaves the cap to the single write that also enforces it', async () => {
    await createMcpApiKey(input, keyGw)

    // Un comptage préalable ici — un second appel — rouvrirait la course que la
    // transaction du gateway ferme.
    expect(createWithinLimit).toHaveBeenCalledTimes(1)
    expect(limit().maxLive).toBe(MCP_KEY_MAX_PER_USER)
  })

  it('forwards the refusal of the cap without yielding a key', async () => {
    createWithinLimit.mockResolvedValue('tooManyKeys')

    expect(await createMcpApiKey(input, keyGw)).toBe('tooManyKeys')
  })

  it('stores only the hash, and returns the plaintext key to its caller', async () => {
    const result = await createMcpApiKey(input, keyGw)
    if (typeof result === 'string') throw new Error(result)

    expect(isWellFormedMcpKey(result.key)).toBe(true)

    expect(written().keyHash).toBe(hashMcpKey(result.key))
    expect(JSON.stringify(written())).not.toContain(result.key)
    expect(result.key.startsWith(written().prefix)).toBe(true)
  })

  it('trims the name and scopes the key to the caller school', async () => {
    await createMcpApiKey(input, keyGw)

    expect(written()).toMatchObject({
      name: 'Poste de Fatima',
      userId: 'user-1',
      schoolId: 'school-1',
    })
  })

  it('dates the expiry from the same instant as the liveness count', async () => {
    await createMcpApiKey(input, keyGw)

    expect(written().expiresAt.getTime() - limit().now.getTime()).toBe(90 * 86_400_000)
  })
})
