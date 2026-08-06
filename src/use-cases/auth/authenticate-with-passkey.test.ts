import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyPasskeyAuthenticationMock = vi.fn()
const userGatewayMock = { findById: vi.fn() }
const sessionGatewayMock = { createForUser: vi.fn() }

vi.mock('@/actions/passkey-actions', () => ({
  verifyPasskeyAuthentication: verifyPasskeyAuthenticationMock,
}))

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

vi.mock('@/gateways/session-gateway', () => ({
  sessionGateway: sessionGatewayMock,
}))

const { authenticateWithPasskey } = await import('./authenticate-with-passkey')

const response = { id: 'credential-id' } as AuthenticationResponseJSON
const requestHeaders = new Headers({ 'user-agent': 'vitest' })

const input = {
  response,
  challengeId: 'a'.repeat(32),
  requestHeaders,
}

describe('authenticateWithPasskey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyPasskeyAuthenticationMock.mockResolvedValue({
      userId: 'user-1',
      email: 'parent@school.test',
    })
    userGatewayMock.findById.mockResolvedValue({ id: 'user-1', isActive: true })
    sessionGatewayMock.createForUser.mockResolvedValue([
      'better-auth.session_token=token.signature; Path=/; HttpOnly',
    ])
  })

  it('returns the session cookies produced by the gateway', async () => {
    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({
      status: 'OK',
      sessionCookies: ['better-auth.session_token=token.signature; Path=/; HttpOnly'],
    })
    expect(verifyPasskeyAuthenticationMock).toHaveBeenCalledWith(response, 'a'.repeat(32))
    expect(sessionGatewayMock.createForUser).toHaveBeenCalledWith('user-1', requestHeaders)
  })

  it('fails when the passkey verification returns a failure discriminant', async () => {
    verifyPasskeyAuthenticationMock.mockResolvedValue('verificationFailed')

    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({ status: 'authenticationFailed' })
    expect(userGatewayMock.findById).not.toHaveBeenCalled()
    expect(sessionGatewayMock.createForUser).not.toHaveBeenCalled()
  })

  it('fails when the challenge expired', async () => {
    verifyPasskeyAuthenticationMock.mockResolvedValue('challengeExpired')

    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({ status: 'authenticationFailed' })
  })

  it('fails when the user no longer exists', async () => {
    userGatewayMock.findById.mockResolvedValue(null)

    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({ status: 'userNotFound' })
    expect(sessionGatewayMock.createForUser).not.toHaveBeenCalled()
  })

  it('fails when the user is deactivated', async () => {
    userGatewayMock.findById.mockResolvedValue({ id: 'user-1', isActive: false })

    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({ status: 'userNotFound' })
    expect(sessionGatewayMock.createForUser).not.toHaveBeenCalled()
  })

  it('fails when the session gateway produces no cookie', async () => {
    sessionGatewayMock.createForUser.mockResolvedValue([])

    const result = await authenticateWithPasskey(input)

    expect(result).toEqual({ status: 'sessionCreationFailed' })
  })
})
