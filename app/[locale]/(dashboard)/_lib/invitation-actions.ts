'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { db } from '@/lib/db'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolAdmin } from './auth-helper'
import { resolveInvitationLocale, sendInvitationEmail } from './invitation-email'

const inviteSchema = z.object({
  // Better Auth n'écrit `User.email` qu'en minuscules. Normaliser ici, à la seule
  // écriture d'`Invitation.email`, évite qu'une casse saisie par l'admin rende le
  // compte invisible à toutes les lectures en aval.
  email: z.email().toLowerCase(),
  role: z.enum(['ADMIN', 'PARENT', 'TEACHER', 'CASHIER']),
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
  // La caisse n'existe que dans une école qui a ouvert les repas.
  if (role === 'CASHIER' && !(await isMealsEnabled(schoolId))) return 'invalidInput'

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
    // Les rôles se cumulent : inviter un membre à un rôle qu'il n'a pas le lui ajoute à
    // l'acceptation, sans seconde appartenance. Une invitation TEACHER lie une fiche
    // enseignant et reste donc permise.
    if (membership?.roles.includes(role) && role !== 'TEACHER') return 'alreadyMember'
  }

  const school = await schoolGateway.findActiveById(schoolId)
  if (!school) return 'notFound'

  const locale = resolveInvitationLocale(parsed.data.locale ?? (await getLocale()))
  const token = crypto.randomUUID()

  const data = {
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
  }
  if (familyId) {
    const created = await db.$transaction(async (tx) => {
      if (!(await lockActiveFamily(tx, schoolId, familyId))) return false
      // Recheck the parent link after acquiring the same lock as a family merge.
      const parent = await tx.familyPerson.findFirst({
        where: {
          schoolId,
          familyId,
          personId,
          person: { email: { equals: email, mode: 'insensitive' } },
        },
        select: { personId: true },
      })
      if (!parent) return false
      await tx.invitation.create({ data })
      return true
    })
    if (!created) return 'invalidInput'
  } else {
    await db.invitation.create({ data })
  }

  const sent = await sendInvitationEmail({ to: email, token, locale, schoolName: school.name })
  if (sent !== 'OK') return 'emailError'

  revalidatePath('/dashboard/users')
  if (familyId) revalidatePath(`/dashboard/families/${familyId}`)
  if (teacherId) revalidatePath('/dashboard/teachers')
  return 'OK'
}

/**
 * Invitation depuis la fiche enseignant : l'adresse est celle de la fiche, jamais une
 * saisie du client. Une invitation encore ouverte pour cette fiche est renvoyée plutôt
 * que doublée, ce qui invalide l'ancien lien.
 */
export async function inviteTeacherAction(input: { teacherId: string }) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = z.object({ teacherId: z.uuid() }).safeParse(input)
  if (!parsed.success) return 'invalidInput'

  const teacher = await db.teacher.findUnique({
    where: { id_schoolId: { id: parsed.data.teacherId, schoolId } },
    select: { id: true, email: true, userId: true, isActive: true },
  })
  if (!teacher?.isActive) return 'notFound'
  if (teacher.userId) return 'alreadyLinked'
  if (!teacher.email) return 'missingEmail'

  const pending = await db.invitation.findFirst({
    where: { schoolId, teacherId: teacher.id, usedAt: null },
    select: { id: true, email: true },
    orderBy: { createdAt: 'desc' },
  })
  if (pending && pending.email === teacher.email.toLowerCase()) {
    const resent = await resendInvitationAction({ id: pending.id })
    if (resent === 'OK') revalidatePath('/dashboard/teachers')
    return resent
  }

  return inviteUserAction({ email: teacher.email, role: 'TEACHER', teacherId: teacher.id })
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
