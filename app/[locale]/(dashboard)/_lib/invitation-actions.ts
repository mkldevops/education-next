'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { db } from '@/lib/db'
import { requireSchoolAdmin } from './auth-helper'
import { resolveInvitationLocale, sendInvitationEmail } from './invitation-email'

const inviteSchema = z.object({
  // Better Auth n'écrit `User.email` qu'en minuscules. Normaliser ici, à la seule
  // écriture d'`Invitation.email`, évite qu'une casse saisie par l'admin rende le
  // compte invisible à toutes les lectures en aval.
  email: z.email().toLowerCase(),
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
  const { schoolId, userId } = await requireSchoolAdmin()

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const { email, role, familyId, personId } = parsed.data
  if ((familyId || personId) && role !== 'PARENT') return 'invalidInput'
  if (personId && !familyId) return 'invalidInput'

  if (familyId && personId) {
    const familyPerson = await db.familyPerson.findUnique({
      where: { familyId_personId: { familyId, personId }, schoolId },
      include: { person: true },
    })
    if (!familyPerson || familyPerson.person.email?.toLowerCase() !== email.toLowerCase()) {
      return 'invalidInput'
    }
  }

  // Une adresse déjà connue n'est plus un refus : un compte peut appartenir à
  // plusieurs écoles. Seule l'appartenance à l'école visée l'est, sinon l'invitation
  // ne rattacherait rien. L'acceptation par un compte existant est gardée par
  // `joinSchoolAction`, qui exige une session à la même adresse.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    const membership = await schoolMemberGateway.findMembership(existing.id, schoolId)
    if (membership) return 'alreadyMember'
  }

  const school = await schoolGateway.findActiveById(schoolId)
  if (!school) return 'notFound'

  const locale = resolveInvitationLocale(parsed.data.locale ?? (await getLocale()))
  const token = crypto.randomUUID()

  await db.invitation.create({
    data: {
      schoolId,
      email,
      role,
      token,
      locale,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      createdById: userId,
      familyId,
      personId,
    },
  })

  const sent = await sendInvitationEmail({ to: email, token, locale, schoolName: school.name })
  if (sent !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  if (familyId) revalidatePath(`/dashboard/families/${familyId}`)
  return 'OK'
}

export async function resendInvitationAction(input: { id: string }) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const invitation = await db.invitation.findUnique({
    where: { id: parsed.data.id, schoolId },
  })
  if (!invitation) return 'notFound'
  if (invitation.usedAt) return 'alreadyUsed'

  const school = await schoolGateway.findActiveById(schoolId)
  if (!school) return 'notFound'

  const token = crypto.randomUUID()
  await db.invitation.update({
    where: { id: invitation.id, schoolId },
    data: { token, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
  })

  const sent = await sendInvitationEmail({
    to: invitation.email,
    token,
    locale: invitation.locale,
    schoolName: school.name,
    variant: 'reminder',
  })
  if (sent !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  return 'OK'
}

export async function revokeInvitationAction(input: { id: string }) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const invitation = await db.invitation.findUnique({
    where: { id: parsed.data.id, schoolId },
  })
  if (!invitation) return 'notFound'
  if (invitation.usedAt) return 'alreadyUsed'

  await db.invitation.delete({ where: { id: invitation.id, schoolId } })

  revalidatePath('/dashboard/users')
  return 'OK'
}
