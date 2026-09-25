import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, isSecretEncryptionConfigured } from '../secret-crypto'

type Env = Record<string, string | undefined>

const hexKey: Env = { SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('hex') }
const base64Key: Env = { SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64') }

describe('secret-crypto', () => {
  it('accepts a 32-byte key in hex or base64, and nothing else', () => {
    expect(isSecretEncryptionConfigured(hexKey)).toBe(true)
    expect(isSecretEncryptionConfigured(base64Key)).toBe(true)
    expect(isSecretEncryptionConfigured({})).toBe(false)
    expect(isSecretEncryptionConfigured({ SETTINGS_ENCRYPTION_KEY: 'short' })).toBe(false)
  })

  it('round-trips a secret without storing it in clear', () => {
    const stored = encryptSecret('plain-secret-value', hexKey)

    expect(stored).not.toBe('notConfigured')
    expect(stored).not.toContain('plain-secret')
    expect(decryptSecret(stored as string, hexKey)).toBe('plain-secret-value')
  })

  it('produces a different ciphertext for each write', () => {
    expect(encryptSecret('same', hexKey)).not.toBe(encryptSecret('same', hexKey))
  })

  it('refuses to encrypt or decrypt without a key', () => {
    expect(encryptSecret('x', {})).toBe('notConfigured')
    expect(decryptSecret('v1:a:b:c', {})).toBe('notConfigured')
  })

  it('reports an unreadable value after a key rotation or a corruption', () => {
    const stored = encryptSecret('plain-secret-value', hexKey) as string

    expect(decryptSecret(stored, base64Key)).toBe('unreadable')
    const [v, iv, tag, ct] = stored.split(':')
    const flipped = `${ct.slice(0, 2)}${ct[2] === 'A' ? 'B' : 'A'}${ct.slice(3)}`
    expect(decryptSecret([v, iv, tag, flipped].join(':'), hexKey)).toBe('unreadable')
    expect(decryptSecret('plain-text', hexKey)).toBe('unreadable')
  })

  it('refuses a truncated authentication tag', () => {
    const stored = encryptSecret('plain-secret-value', hexKey) as string
    const [v, iv, tag, ct] = stored.split(':')
    const shortTag = Buffer.from(tag, 'base64').subarray(0, 12).toString('base64')

    expect(Buffer.from(tag, 'base64')).toHaveLength(16)
    expect(decryptSecret([v, iv, shortTag, ct].join(':'), hexKey)).toBe('unreadable')
    expect(decryptSecret([v, iv, '', ct].join(':'), hexKey)).toBe('unreadable')
  })
})
