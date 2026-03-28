'use server'

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

const rpName = process.env.NEXT_PUBLIC_APP_NAME || 'Education App'
const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const rpID = process.env.NEXT_PUBLIC_APP_DOMAIN || new URL(origin).hostname

export async function getPasskeyRegistrationOptions(passkeyName: string) {
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
      transports: pk.transports
        ? (pk.transports.split(',') as AuthenticatorTransport[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  await db.verification.upsert({
    where: { identifier: `passkey-challenge:${session.user.id}` },
    update: {
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    create: {
      identifier: `passkey-challenge:${session.user.id}`,
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return { options, passkeyName }
}

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  passkeyName: string
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const

  const challengeRecord = await db.verification.findUnique({
    where: { identifier: `passkey-challenge:${session.user.id}` },
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
    where: { identifier: `passkey-challenge:${session.user.id}` },
  })

  return 'OK' as const
}

export async function getPasskeyAuthenticationOptions() {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  })

  await db.verification.upsert({
    where: { identifier: 'passkey-auth-challenge' },
    update: {
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    create: {
      identifier: 'passkey-auth-challenge',
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return options
}

export async function verifyPasskeyAuthentication(response: AuthenticationResponseJSON) {
  const challengeRecord = await db.verification.findUnique({
    where: { identifier: 'passkey-auth-challenge' },
  })

  if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
    return 'challengeExpired' as const
  }

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  })

  if (!passkey) return 'passkeyNotFound' as const

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.value,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64'),
      counter: Number(passkey.counter),
      transports: passkey.transports
        ? (passkey.transports.split(',') as AuthenticatorTransport[])
        : undefined,
    },
  })

  if (!verification.verified) return 'verificationFailed' as const

  await db.passkey.update({
    where: { credentialId: response.id },
    data: { counter: verification.authenticationInfo.newCounter },
  })

  await db.verification.delete({ where: { identifier: 'passkey-auth-challenge' } })

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
