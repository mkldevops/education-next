'use server'

import { z } from 'zod'
import { credentialUserGateway } from '@/gateways/credential-user-gateway'
import { db } from '@/lib/db'
import { findInvitationByToken } from '@/lib/db-unscoped'
import { findAccountByEmail, normalizeEmail } from './invited-email'
import { linkInvitedUser } from './link-invited-user'

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
})

/**
 * Acceptation par création de compte.
 *
 * Le garde `emailAlreadyUsed` reste ici, et seulement ici : ce chemin crée un compte,
 * donc une adresse déjà prise n'est pas une invitation à en fabriquer un second. Un
 * compte existant passe par `joinSchoolAction`, qui exige une session.
 */
export async function acceptInvitationAction(input: {
  token: string
  name: string
  password: string
}) {
  const parsed = acceptSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const { token, name, password } = parsed.data

  const invitation = await findInvitationByToken(token)
  if (!invitation) return 'invalid'
  if (invitation.usedAt) return 'alreadyUsed'
  if (invitation.expiresAt < new Date()) return 'expired'

  const existing = await findAccountByEmail(invitation.email)
  if (existing) return 'emailAlreadyUsed'

  let createdUserId: string | undefined

  try {
    // Le compte naît vérifié : le jeton a été reçu sur cette adresse.
    const created = await credentialUserGateway.create({
      name,
      email: normalizeEmail(invitation.email),
      password,
    })
    createdUserId = created.id

    const outcome = await db.$transaction((tx) => linkInvitedUser(tx, invitation, created.id))

    if (outcome !== 'OK') {
      await db.user.delete({ where: { id: created.id } }).catch(() => undefined)
      return outcome
    }

    return 'OK'
  } catch {
    if (createdUserId) {
      await db.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
    }
    return 'error'
  }
}
