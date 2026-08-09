'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from './auth-helper'
import { resolveInvitationLocale, sendInvitationEmail } from './invitation-email'

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['ADMIN', 'PARENT']),
  familyId: z.uuid().optional(),
  personId: z.uuid().optional(),
  locale: z.string().max(5).optional(),
})

const invitationIdSchema = z.object({ id: z.string().min(1) })

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000

export async function inviteUserAction(input: {
  email: string
  role: string
  familyId?: string
  personId?: string
  locale?: string
}) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized'

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const { email, role, familyId, personId } = parsed.data
  if ((familyId || personId) && role !== 'PARENT') return 'invalidInput'
  if (personId && !familyId) return 'invalidInput'

  if (familyId && personId) {
    const familyPerson = await db.familyPerson.findUnique({
      where: { familyId_personId: { familyId, personId } },
      include: { person: true },
    })
    if (!familyPerson || familyPerson.person.email?.toLowerCase() !== email.toLowerCase()) {
      return 'invalidInput'
    }
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return 'emailAlreadyUsed'

  const locale = resolveInvitationLocale(parsed.data.locale ?? (await getLocale()))
  const token = crypto.randomUUID()

  await db.invitation.create({
    data: {
      email,
      role,
      token,
      locale,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      createdById: user.id,
      familyId,
      personId,
    },
  })

  const sent = await sendInvitationEmail({ to: email, token, locale })
  if (sent !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  if (familyId) revalidatePath(`/dashboard/families/${familyId}`)
  return 'OK'
}

export async function resendInvitationAction(input: { id: string }) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized'

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const invitation = await db.invitation.findUnique({ where: { id: parsed.data.id } })
  if (!invitation) return 'notFound'
  if (invitation.usedAt) return 'alreadyUsed'

  const token = crypto.randomUUID()
  await db.invitation.update({
    where: { id: invitation.id },
    data: { token, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
  })

  const sent = await sendInvitationEmail({
    to: invitation.email,
    token,
    locale: invitation.locale,
  })
  if (sent !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  return 'OK'
}

export async function revokeInvitationAction(input: { id: string }) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized'

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const invitation = await db.invitation.findUnique({ where: { id: parsed.data.id } })
  if (!invitation) return 'notFound'
  if (invitation.usedAt) return 'alreadyUsed'

  await db.invitation.delete({ where: { id: invitation.id } })

  revalidatePath('/dashboard/users')
  return 'OK'
}
