import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteOpenRouterApiKey,
  getOpenRouterKeyStatus,
  readOpenRouterApiKey,
  setOpenRouterApiKey,
} from './openrouter-api-key'

const rows = new Map<string, { id: string; name: string; value: string; valueType: 'TEXT' }>()

const gateway: NonNullable<Parameters<typeof setOpenRouterApiKey>[1]> = {
  get: vi.fn(async (name: string) => rows.get(name) ?? null),
  set: vi.fn(async (data: { name: string; value: string; valueType: 'TEXT' }) => {
    const row = { id: 'row-1', ...data }
    rows.set(data.name, row)
    return row
  }),
  delete: vi.fn(async (name: string) => ({ count: rows.delete(name) ? 1 : 0 })),
}

const secret = 'test-openrouter-key-placeholder'

beforeEach(() => {
  rows.clear()
  vi.clearAllMocks()
  vi.stubEnv('SETTINGS_ENCRYPTION_KEY', randomBytes(32).toString('hex'))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('setOpenRouterApiKey', () => {
  it('stores the key encrypted, never in clear', async () => {
    expect(await setOpenRouterApiKey(secret, gateway)).toBe('OK')

    const stored = rows.get('openrouter_api_key')
    expect(stored?.valueType).toBe('TEXT')
    expect(stored?.value).not.toContain(secret)
    expect(stored?.value.startsWith('v1:')).toBe(true)
  })

  it('replaces a previous key', async () => {
    await setOpenRouterApiKey(secret, gateway)
    await setOpenRouterApiKey(`${secret}-next`, gateway)

    expect(await readOpenRouterApiKey(gateway)).toBe(`${secret}-next`)
  })

  it('refuses a blank, short or spaced value', async () => {
    expect(await setOpenRouterApiKey('', gateway)).toBe('validationError')
    expect(await setOpenRouterApiKey('sk-or', gateway)).toBe('validationError')
    expect(await setOpenRouterApiKey(`${secret} trailing`, gateway)).toBe('validationError')
    expect(await setOpenRouterApiKey(42, gateway)).toBe('validationError')
    expect(gateway.set).not.toHaveBeenCalled()
  })

  it('refuses to store anything without an encryption key', async () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '')

    expect(await setOpenRouterApiKey(secret, gateway)).toBe('secretStorageNotConfigured')
    expect(gateway.set).not.toHaveBeenCalled()
  })
})

describe('deleteOpenRouterApiKey', () => {
  it('removes the row and reports the key as not configured', async () => {
    await setOpenRouterApiKey(secret, gateway)

    expect(await deleteOpenRouterApiKey(gateway)).toBe('OK')
    expect(await getOpenRouterKeyStatus(gateway)).toBe('notConfigured')
    expect(await readOpenRouterApiKey(gateway)).toBeNull()
  })

  it('is idempotent', async () => {
    expect(await deleteOpenRouterApiKey(gateway)).toBe('OK')
  })
})

describe('getOpenRouterKeyStatus', () => {
  it('never exposes the value', async () => {
    await setOpenRouterApiKey(secret, gateway)

    expect(await getOpenRouterKeyStatus(gateway)).toBe('configured')
  })

  it('reports an unreadable key after an encryption key rotation', async () => {
    await setOpenRouterApiKey(secret, gateway)
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', randomBytes(32).toString('hex'))

    expect(await getOpenRouterKeyStatus(gateway)).toBe('unreadable')
    expect(await readOpenRouterApiKey(gateway)).toBeNull()
  })

  it('reports an unreadable key when the encryption key is missing', async () => {
    await setOpenRouterApiKey(secret, gateway)
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '')

    expect(await getOpenRouterKeyStatus(gateway)).toBe('unreadable')
  })
})
