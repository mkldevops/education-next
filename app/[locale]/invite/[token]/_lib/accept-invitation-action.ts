'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { findInvitationByToken } from '@/lib/db-unscoped'
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

  const existing = await db.user.findUnique({ where: { email: invitation.email } })
  if (existing) return 'emailAlreadyUsed'

  let createdUserId: string | undefined

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name,
        email: invitation.email,
        password,
      },
    })
    createdUserId = res.user.id

    const outcome = await db.$transaction(async (tx) => {
      const linked = await linkInvitedUser(tx, invitation, res.user.id)
      if (linked !== 'OK') return linked

      await tx.user.update({
        where: { id: res.user.id },
        data: { emailVerified: true },
      })

      return 'OK' as const
    })

    if (outcome !== 'OK') {
      await db.user.delete({ where: { id: res.user.id } }).catch(() => undefined)
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
