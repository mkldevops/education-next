'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { findInvitationByToken } from '@/lib/db-unscoped'
import { linkInvitedUser } from './link-invited-user'

const joinSchema = z.object({ token: z.string().min(1) })

/**
 * Acceptation d'une invitation par un compte qui existe déjà.
 *
 * Ce chemin ne crée aucun compte et n'accepte aucun mot de passe : il exige une
 * session authentifiée dont l'adresse est celle de l'invitation. Sans cette égalité,
 * la levée du garde `emailAlreadyUsed` à l'émission deviendrait une prise de contrôle
 * de compte — quiconque détient le jeton rattacherait le compte d'un tiers, ou s'y
 * rattacherait lui-même.
 */
export async function joinSchoolAction(input: { token: string }) {
  const parsed = joinSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput' as const

  const session = await auth.api.getSession({ headers: await headers() })
  const sessionEmail = session?.user?.email
  const userId = session?.user?.id
  if (!userId || !sessionEmail) return 'unauthenticated' as const

  const invitation = await findInvitationByToken(parsed.data.token)
  if (!invitation) return 'invalid' as const
  if (invitation.usedAt) return 'alreadyUsed' as const
  if (invitation.expiresAt < new Date()) return 'expired' as const

  if (sessionEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return 'emailMismatch' as const
  }

  try {
    return await db.$transaction((tx) => linkInvitedUser(tx, invitation, userId))
  } catch {
    return 'error' as const
  }
}
