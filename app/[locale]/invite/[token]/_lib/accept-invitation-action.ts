'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { findInvitationByToken } from '@/lib/db-unscoped'

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
})

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

    await db.$transaction(async (tx) => {
      // Le `SchoolMember` doit exister avant le `UserFamily` : sa clé étrangère
      // composite `(userId, schoolId) -> SchoolMember` bloquerait sinon l'insertion.
      await tx.schoolMember.create({
        data: {
          userId: res.user.id,
          schoolId: invitation.schoolId,
          role: invitation.role,
        },
      })

      await tx.user.update({
        where: { id: res.user.id },
        data: { emailVerified: true },
      })

      if (invitation.familyId) {
        await tx.userFamily.upsert({
          where: {
            userId_familyId: { userId: res.user.id, familyId: invitation.familyId },
            schoolId: invitation.schoolId,
          },
          create: {
            userId: res.user.id,
            familyId: invitation.familyId,
            schoolId: invitation.schoolId,
          },
          update: {},
        })
      }

      await tx.invitation.update({
        where: { id: invitation.id, schoolId: invitation.schoolId },
        data: { usedAt: new Date() },
      })
    })

    return 'OK'
  } catch {
    if (createdUserId) {
      await db.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
    }
    return 'error'
  }
}
