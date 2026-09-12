import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const isPasskeySignInEnabledMock = vi.fn()
const findUniqueVerificationMock = vi.fn()
const deleteVerificationMock = vi.fn()
const findUniquePasskeyMock = vi.fn()

vi.mock('@/use-cases/platform-settings/is-passkey-sign-in-enabled', () => ({
  isPasskeySignInEnabled: isPasskeySignInEnabledMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    verification: {
      findUnique: findUniqueVerificationMock,
      delete: deleteVerificationMock,
    },
    passkey: {
      findUnique: findUniquePasskeyMock,
    },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const { verifyPasskeyAuthentication } = await import('./passkey-actions')

const response = { id: 'credential-id' } as AuthenticationResponseJSON
const challengeId = 'a'.repeat(32)

beforeEach(() => {
  vi.clearAllMocks()
  isPasskeySignInEnabledMock.mockResolvedValue(true)
  deleteVerificationMock.mockResolvedValue(undefined)
})

describe('verifyPasskeyAuthentication', () => {
  it('refuses before reading the challenge when passkey sign-in is disabled', async () => {
    isPasskeySignInEnabledMock.mockResolvedValue(false)

    const result = await verifyPasskeyAuthentication(response, challengeId)

    expect(result).toBe('signInDisabled')
    expect(findUniqueVerificationMock).not.toHaveBeenCalled()
    expect(findUniquePasskeyMock).not.toHaveBeenCalled()
  })

  it('still reads the challenge when passkey sign-in is enabled', async () => {
    findUniqueVerificationMock.mockResolvedValue(null)

    const result = await verifyPasskeyAuthentication(response, challengeId)

    expect(result).toBe('challengeExpired')
    expect(findUniqueVerificationMock).toHaveBeenCalledWith({
      where: { identifier: `passkey-auth-challenge:${challengeId}` },
    })
  })
})
