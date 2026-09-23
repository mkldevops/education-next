import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const isPasskeySignInEnabledMock = vi.fn()
const findUniqueVerificationMock = vi.fn()
const deleteVerificationMock = vi.fn()
const findUniquePasskeyMock = vi.fn()
const findManyPasskeyMock = vi.fn()
const findFirstPasskeyMock = vi.fn()
const deletePasskeyMock = vi.fn()
const getSessionMock = vi.fn()

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
      findMany: findManyPasskeyMock,
      findFirst: findFirstPasskeyMock,
      delete: deletePasskeyMock,
    },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const {
  deletePasskey,
  getPasskeyRegistrationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} = await import('./passkey-actions')

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

describe('passkey management while impersonating', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'parent@school.test' },
      session: { impersonatedBy: 'super-admin-1' },
    })
  })

  it('refuses the registration options before reading any passkey', async () => {
    expect(await getPasskeyRegistrationOptions('Laptop')).toEqual({ error: 'impersonating' })
    expect(findManyPasskeyMock).not.toHaveBeenCalled()
  })

  it('refuses the registration before reading the challenge', async () => {
    const result = await verifyPasskeyRegistration(
      {} as Parameters<typeof verifyPasskeyRegistration>[0],
      'Laptop'
    )

    expect(result).toBe('impersonating')
    expect(findUniqueVerificationMock).not.toHaveBeenCalled()
  })

  it('refuses the deletion before touching the passkey', async () => {
    expect(await deletePasskey('passkey-1')).toBe('impersonating')
    expect(findFirstPasskeyMock).not.toHaveBeenCalled()
    expect(deletePasskeyMock).not.toHaveBeenCalled()
  })
})
