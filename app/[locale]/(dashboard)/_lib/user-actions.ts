'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { canAssignRole } from '@/domain/user'
import { userGateway } from '@/gateways/user-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'
import { changeUserRole } from '@/use-cases/users/change-user-role'
import { deleteUser } from '@/use-cases/users/delete-user'
import { linkUserFamily, unlinkUserFamily } from '@/use-cases/users/link-user-family'
import { revokeUserSessions } from '@/use-cases/users/revoke-user-sessions'
import { deactivateUser, reactivateUser } from '@/use-cases/users/set-user-active'
import { updateUser } from '@/use-cases/users/update-user'
import { requireAdmin, requireAdminActor, requireSuperAdmin } from './auth-helper'

const USERS_PATH = '/dashboard/users'

export async function createUserAction(data: {
  name: string
  email: string
  password: string
  role: Role
}) {
  const admin = await requireAdminActor()
  if (!admin) return 'unauthorized' as const
  if (!canAssignRole(admin.role, data.role)) return 'unauthorized' as const

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
      },
    })

    await db.user.update({
      where: { id: res.user.id },
      data: {
        role: data.role,
        emailVerified: true,
      },
    })

    revalidatePath('/dashboard')
    return { id: res.user.id, email: data.email }
  } catch {
    return 'error' as const
  }
}

export async function getUserDetailAction(id: string) {
  const admin = await requireAdmin()
  if (!admin) return null

  return userGateway.findDetail(id)
}

export async function changeUserRoleAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await changeUserRole(actor, input as { id: string; role: Role })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function updateUserAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await updateUser(
    input as { id: string; name?: string | null; email?: string; emailVerified?: boolean }
  )
  if (typeof result === 'string') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function deactivateUserAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await deactivateUser(actor, input as { id: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function reactivateUserAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await reactivateUser(actor, input as { id: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

const deleteUserSchema = z.object({ id: z.cuid(), confirmation: z.string().min(1) })

export async function deleteUserAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const parsed = deleteUserSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const
  if (target.email.toLowerCase() !== parsed.data.confirmation.trim().toLowerCase()) {
    return 'confirmationMismatch' as const
  }

  const result = await deleteUser(actor, { id: parsed.data.id })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function revokeUserSessionsAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await revokeUserSessions(input as { id: string })
  if (typeof result === 'string') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

const passwordResetSchema = z.object({ id: z.cuid() })

export async function sendPasswordResetAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const parsed = passwordResetSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const
  if (!target.isActive) return 'alreadyInactive' as const

  try {
    await auth.api.requestPasswordReset({
      body: { email: target.email, redirectTo: '/reset-password' },
    })
    return 'OK' as const
  } catch {
    return 'emailError' as const
  }
}

export async function linkUserFamilyAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await linkUserFamily(input as { id: string; familyId: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function unlinkUserFamilyAction(input: unknown) {
  const actor = await requireSuperAdmin()
  if (!actor) return 'unauthorized' as const

  const result = await unlinkUserFamily(input as { id: string; familyId: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}
