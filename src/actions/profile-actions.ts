'use server'

import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { PrismaProfileGateway } from '@/gateways/prisma-profile-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendPlatformEmail } from '@/lib/platform-email'
import { deleteProfile } from '@/use-cases/commands/delete-profile'
import { type UpdateProfileData, updateProfile } from '@/use-cases/commands/update-profile'

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
  })

export async function updateProfileAction(data: UpdateProfileData): Promise<ActionResult<null>> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return { success: false, error: 'unauthorized' }
  }

  const gateway = new PrismaProfileGateway(db)
  const result = await updateProfile(userId, data, gateway)

  if (result !== 'OK') {
    return { success: false, error: result }
  }

  return { success: true, data: null }
}

export async function deleteProfileAction(): Promise<ActionResult<null>> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return { success: false, error: 'unauthorized' }
  }

  const gateway = new PrismaProfileGateway(db)
  const result = await deleteProfile(userId, gateway)

  if (result !== 'OK') {
    return { success: false, error: result }
  }

  return { success: true, data: null }
}

export async function changePasswordAction(data: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<ActionResult<null>> {
  const parsed = changePasswordSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'validationError' }
  }

  const requestHeaders = await headers()

  try {
    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
    })
  } catch {
    return { success: false, error: 'invalidCurrentPassword' }
  }

  // Notification de sécurité, émise après coup : le mot de passe est déjà changé,
  // un échec d'envoi ne doit donc pas faire croire à l'appelant que l'opération a
  // échoué et l'inciter à recommencer.
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (session?.user?.email) {
    const t = await getTranslations('emails.passwordChanged')
    await sendPlatformEmail(session.user.email, t('subject'), {
      preheader: t('body'),
      heading: t('heading'),
      paragraphs: [t('body')],
      notice: t('notice'),
      footer: t('footer'),
    })
  }

  return { success: true, data: null }
}

const changeEmailSchema = z.object({ newEmail: z.email().toLowerCase() })

/**
 * Changement d'adresse en libre-service. La confirmation part sur l'adresse
 * actuelle (`user.changeEmail.sendChangeEmailConfirmation`, `src/lib/auth.ts`) :
 * l'adresse du compte n'est réécrite qu'une fois ce lien suivi.
 *
 * Better Auth répond succès sans rien émettre lorsque la nouvelle adresse est
 * déjà prise, pour ne pas transformer ce formulaire en oracle d'existence de
 * compte. Le message affiché à l'utilisateur reste donc « vérifiez votre boîte »
 * dans les deux cas.
 */
export async function changeEmailAction(data: { newEmail: string }): Promise<ActionResult<null>> {
  const parsed = changeEmailSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'validationError' }
  }

  try {
    await auth.api.changeEmail({
      headers: await headers(),
      body: { newEmail: parsed.data.newEmail, callbackURL: '/dashboard/settings' },
    })
    return { success: true, data: null }
  } catch {
    return { success: false, error: 'error' }
  }
}

type SessionInfo = {
  id: string
  token: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: Date
  expiresAt: Date
  isCurrent: boolean
}

async function _listSessionsAction(): Promise<ActionResult<SessionInfo[]>> {
  try {
    const reqHeaders = await headers()
    const currentSession = await auth.api.getSession({ headers: reqHeaders })
    if (!currentSession) {
      return { success: false, error: 'unauthorized' }
    }

    const sessions = await db.session.findMany({
      where: {
        userId: currentSession.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result: SessionInfo[] = sessions.map((s) => ({
      id: s.id,
      token: s.token,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.token === currentSession.session.token,
    }))

    return { success: true, data: result }
  } catch {
    return { success: false, error: 'unauthorized' }
  }
}

export async function revokeSessionAction(token: string): Promise<ActionResult<null>> {
  try {
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token },
    })
    return { success: true, data: null }
  } catch {
    return { success: false, error: 'sessionRevokeFailed' }
  }
}
