import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { verifyPasskeyAuthentication } from '@/actions/passkey-actions'
import { sessionGateway } from '@/gateways/session-gateway'
import { userGateway } from '@/gateways/user-gateway'

export type AuthenticateWithPasskeyResult =
  | { status: 'OK'; sessionCookies: string[] }
  | { status: 'authenticationFailed' | 'userNotFound' | 'sessionCreationFailed' }

export type AuthenticateWithPasskeyInput = {
  response: AuthenticationResponseJSON
  challengeId: string
  requestHeaders: Headers
}

export async function authenticateWithPasskey(
  input: AuthenticateWithPasskeyInput
): Promise<AuthenticateWithPasskeyResult> {
  const verification = await verifyPasskeyAuthentication(input.response, input.challengeId)
  if (typeof verification === 'string') return { status: 'authenticationFailed' }

  const user = await userGateway.findById(verification.userId)
  if (!user?.isActive) return { status: 'userNotFound' }

  const sessionCookies = await sessionGateway.createForUser(user.id, input.requestHeaders)
  if (sessionCookies.length === 0) return { status: 'sessionCreationFailed' }

  return { status: 'OK', sessionCookies }
}
