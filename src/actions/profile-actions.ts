'use server'

import { headers } from 'next/headers'
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
