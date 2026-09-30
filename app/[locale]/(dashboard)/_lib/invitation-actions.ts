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
  role: z.enum(['ADMIN', 'PARENT', 'TEACHER']),
  familyId: z.uuid().optional(),
  personId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  locale: z.string().max(5).optional(),
})

const invitationIdSchema = z.object({ id: z.string().min(1) })

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000

const nextInvitationExpiry = () => new Date(Date.now() + INVITATION_TTL_MS)

async function findPendingInvitation(schoolId: string, input: unknown) {
  const parsed = invitationIdSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput' as const

  const invitation = await db.invitation.findUnique({
    where: { id: parsed.data.id, schoolId },
  })
  if (!invitation) return 'notFound' as const
  if (invitation.usedAt) return 'alreadyUsed' as const
  return invitation
}

export async function inviteUserAction(input: {
  email: string
  role: string
  familyId?: string
  personId?: string
  teacherId?: string
  locale?: string
}) {
  const { schoolId, userId } = await requireSchoolAdmin()

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const { email, role, familyId, teacherId } = parsed.data
  if ((familyId || parsed.data.personId) && role !== 'PARENT') return 'invalidInput'
  if (parsed.data.personId && !familyId) return 'invalidInput'
  if (teacherId && role !== 'TEACHER') return 'invalidInput'
  if (role === 'TEACHER' && !teacherId) return 'invalidInput'

  // Une famille ne se rattache jamais seule : l'invitation doit nommer le parent de
  // cette famille dont l'adresse est celle invitée. Le formulaire des utilisateurs ne
  // choisit que la famille ; le parent est alors résolu ici par l'adresse. Sans cette
  // correspondance, un tiers recevrait l'accès aux enfants et aux paiements de la famille.
  let personId: string | undefined
  if (familyId) {
    const familyPerson = await db.familyPerson.findFirst({
      where: {
        familyId,
        schoolId,
        ...(parsed.data.personId ? { personId: parsed.data.personId } : {}),
        person: { email: { equals: email, mode: 'insensitive' } },
      },
      select: { personId: true },
    })
    if (!familyPerson) return 'invalidInput'
    personId = familyPerson.personId
  }

  if (teacherId) {
    // `Teacher` n'est pas couvert par l'extension soft-delete : l'archivage se vérifie ici.
    const teacher = await db.teacher.findUnique({
      where: { id_schoolId: { id: teacherId, schoolId } },
      select: { id: true, email: true, userId: true, isActive: true },
    })
    if (!teacher?.isActive || teacher.userId || teacher.email?.toLowerCase() !== email) {
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
    // Une invitation TEACHER peut ajouter cette capacité à un ADMIN/PARENT déjà
    // membre de l'école. Elle ne crée pas une seconde appartenance à l'acceptation.
    if (membership && role !== 'TEACHER') return 'alreadyMember'
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
      expiresAt: nextInvitationExpiry(),
      createdById: userId,
      familyId,
      personId,
      teacherId,
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

  const invitation = await findPendingInvitation(schoolId, input)
  if (typeof invitation === 'string') return invitation

  const school = await schoolGateway.findActiveById(schoolId)
  if (!school) return 'notFound'

  const token = crypto.randomUUID()
  await db.invitation.update({
    where: { id: invitation.id, schoolId },
    data: { token, expiresAt: nextInvitationExpiry() },
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

  const invitation = await findPendingInvitation(schoolId, input)
  if (typeof invitation === 'string') return invitation

  await db.invitation.delete({ where: { id: invitation.id, schoolId } })

  revalidatePath('/dashboard/users')
  return 'OK'
}
