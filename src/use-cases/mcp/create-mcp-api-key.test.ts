import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isWellFormedMcpKey, MCP_KEY_MAX_PER_USER } from '@/domain/mcp-key'
import { hashMcpKey } from '@/lib/mcp-key-crypto'
import { createMcpApiKey } from './create-mcp-api-key'

const countLive = vi.fn()
const create = vi.fn()
const keyGw = { countLive, create }

const input = {
  name: '  Poste de Fatima  ',
  lifetimeDays: 90,
  userId: 'user-1',
  schoolId: 'school-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  countLive.mockResolvedValue(0)
  create.mockImplementation(async (data) => ({ id: 'key-1', ...data }))
})

describe('createMcpApiKey', () => {
  it('refuses a lifetime that is not one of the offered durations', async () => {
    expect(await createMcpApiKey({ ...input, lifetimeDays: 3650 }, keyGw)).toBe('validationError')
    expect(await createMcpApiKey({ ...input, name: '   ' }, keyGw)).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('refuses once the holder already carries the maximum of live keys', async () => {
    countLive.mockResolvedValue(MCP_KEY_MAX_PER_USER)

    expect(await createMcpApiKey(input, keyGw)).toBe('tooManyKeys')
    expect(create).not.toHaveBeenCalled()
  })

  it('stores only the hash, and returns the plaintext key to its caller', async () => {
    const result = await createMcpApiKey(input, keyGw)
    if (typeof result === 'string') throw new Error(result)

    expect(isWellFormedMcpKey(result.key)).toBe(true)

    const [data] = create.mock.calls[0]
    expect(data.keyHash).toBe(hashMcpKey(result.key))
    expect(JSON.stringify(data)).not.toContain(result.key)
    expect(result.key.startsWith(data.prefix)).toBe(true)
  })

  it('trims the name and scopes the key to the caller school', async () => {
    await createMcpApiKey(input, keyGw)

    expect(create.mock.calls[0][0]).toMatchObject({
      name: 'Poste de Fatima',
      userId: 'user-1',
      schoolId: 'school-1',
    })
  })

  it('gives every key an expiry', async () => {
    await createMcpApiKey(input, keyGw)

    const { expiresAt } = create.mock.calls[0][0]
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 90 * 86_400_000)
  })
})
