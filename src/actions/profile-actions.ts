'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import type { ProfileState } from '@/domain/profile'
import { PrismaProfileGateway } from '@/gateways/prisma-profile-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteProfile } from '@/use-cases/commands/delete-profile'
import { type UpdateProfileData, updateProfile } from '@/use-cases/commands/update-profile'
import { getProfile } from '@/use-cases/queries/get-profile'

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

export async function getProfileAction(): Promise<ActionResult<ProfileState>> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return { success: false, error: 'unauthorized' }
  }

  const gateway = new PrismaProfileGateway(db)
  const result = await getProfile(userId, gateway)

  if (result === 'profileNotFound') {
    return { success: false, error: result }
  }

  return { success: true, data: result }
}

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

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
    })
    return { success: true, data: null }
  } catch {
    return { success: false, error: 'invalidCurrentPassword' }
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

async function listSessionsAction(): Promise<ActionResult<SessionInfo[]>> {
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
