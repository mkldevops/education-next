'use server'

import { randomBytes } from 'node:crypto'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'

const rpName = process.env.NEXT_PUBLIC_APP_NAME || 'Education App'
const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const rpID = process.env.NEXT_PUBLIC_APP_DOMAIN || new URL(origin).hostname
const CHALLENGE_TTL_MS = 5 * 60 * 1000

const registrationChallengeKey = (userId: string) => `passkey-challenge:${userId}`
const authChallengeKey = (challengeId: string) => `passkey-auth-challenge:${challengeId}`

function parseTransports(value: string | null) {
  return value ? (value.split(',') as AuthenticatorTransport[]) : undefined
}

async function storeChallenge(identifier: string, challenge: string) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)
  await db.verification.upsert({
    where: { identifier },
    update: { value: challenge, expiresAt },
    create: { identifier, value: challenge, expiresAt },
  })
}

async function discardAuthChallenge(challengeId: string) {
  await db.verification
    .delete({ where: { identifier: authChallengeKey(challengeId) } })
    .catch(() => {})
}

export async function getPasskeyRegistrationOptions(passkeyName: string) {
  if (!(await isPasskeySignInEnabled())) return { error: 'signInDisabled' as const }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: 'unauthorized' as const }

  const existingPasskeys = await db.passkey.findMany({
    where: { userId: session.user.id },
    select: { credentialId: true, transports: true },
  })

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: session.user.email,
    userDisplayName: session.user.name || session.user.email,
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: parseTransports(pk.transports),
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  await storeChallenge(registrationChallengeKey(session.user.id), options.challenge)

  return { options, passkeyName }
}

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  passkeyName: string
) {
  if (!(await isPasskeySignInEnabled())) return 'signInDisabled' as const

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const

  const challengeRecord = await db.verification.findUnique({
    where: { identifier: registrationChallengeKey(session.user.id) },
  })

  if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
    return 'challengeExpired' as const
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.value,
    expectedOrigin: origin,
    expectedRPID: rpID,
  })

  if (!verification.verified || !verification.registrationInfo) {
    return 'verificationFailed' as const
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  await db.passkey.create({
    data: {
      userId: session.user.id,
      name: passkeyName,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: response.response.transports?.join(',') ?? null,
    },
  })

  await db.verification.delete({
    where: { identifier: registrationChallengeKey(session.user.id) },
  })

  return 'OK' as const
}

export async function getPasskeyAuthenticationOptions() {
  if (!(await isPasskeySignInEnabled())) return { error: 'signInDisabled' as const }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  })

  const challengeId = randomBytes(16).toString('hex')

  await storeChallenge(authChallengeKey(challengeId), options.challenge)

  return { ...options, challengeId }
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  challengeId: string
) {
  if (!(await isPasskeySignInEnabled())) return 'signInDisabled' as const

  const challengeRecord = await db.verification.findUnique({
    where: { identifier: authChallengeKey(challengeId) },
  })

  if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
    await discardAuthChallenge(challengeId)
    return 'challengeExpired' as const
  }

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  })

  if (!passkey) {
    await discardAuthChallenge(challengeId)
    return 'passkeyNotFound' as const
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.value,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64'),
      counter: Number(passkey.counter),
      transports: parseTransports(passkey.transports),
    },
  })

  if (!verification.verified) {
    await discardAuthChallenge(challengeId)
    return 'verificationFailed' as const
  }

  await db.passkey.update({
    where: { credentialId: response.id },
    data: { counter: verification.authenticationInfo.newCounter },
  })

  await db.verification.delete({ where: { identifier: authChallengeKey(challengeId) } })

  return { userId: passkey.userId, email: passkey.user.email }
}

export async function getUserPasskeys() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return []

  return db.passkey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, deviceType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deletePasskey(passkeyId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const

  const passkey = await db.passkey.findFirst({
    where: { id: passkeyId, userId: session.user.id },
  })

  if (!passkey) return 'notFound' as const

  await db.passkey.delete({ where: { id: passkeyId } })
  return 'OK' as const
}
