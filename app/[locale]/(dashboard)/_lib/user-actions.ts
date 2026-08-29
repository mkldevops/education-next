'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { userGateway } from '@/gateways/user-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { SchoolRole } from '@/types/enums'
import { changePlatformLevel } from '@/use-cases/users/change-platform-level'
import { deleteUser } from '@/use-cases/users/delete-user'
import { linkUserFamily, unlinkUserFamily } from '@/use-cases/users/link-user-family'
import { revokeUserSessions } from '@/use-cases/users/revoke-user-sessions'
import { deactivateUser, reactivateUser } from '@/use-cases/users/set-user-active'
import { updateUser } from '@/use-cases/users/update-user'
import { requirePlatformAdmin, requireSchoolAdmin } from './auth-helper'

const USERS_PATH = '/dashboard/users'

const CreateUserSchema = z.object({
  name: z.string().min(1),
  // Même normalisation que `updateUserSchema` : deux schémas divergents rouvriraient
  // le trou de casse par l'autre porte.
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'PARENT']),
})

export async function createUserAction(data: {
  name: string
  email: string
  password: string
  role: SchoolRole
}) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = CreateUserSchema.safeParse(data)
  if (!parsed.success) return 'validation_error' as const

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
    })

    await db.user.update({
      where: { id: res.user.id },
      data: { emailVerified: true },
    })
    await schoolMemberGateway.createMembership(res.user.id, schoolId, parsed.data.role)

    revalidatePath('/dashboard/users')
    return { id: res.user.id, email: parsed.data.email }
  } catch {
    return 'error' as const
  }
}

/**
 * Détail d'un membre de l'école active.
 *
 * L'appartenance est vérifiée avant la lecture, et ce n'est pas redondant avec le
 * garde : une Server Action est un endpoint HTTP appelable directement, donc `id`
 * est une entrée non fiable. Sans cette vérification, un administrateur d'école
 * connaissant un `User.id` d'une autre école lisait son email, les adresses IP de
 * ses sessions et le nom de ses passkeys — `Session`, `Account` et `Passkey` sont
 * des modèles plateforme, que ni le garde tenant ni le filtre de `findDetail`
 * ne peuvent scoper.
 */
export async function getUserDetailAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()

  const membership = await schoolMemberGateway.findMembership(id, schoolId)
  if (!membership) return null

  return userGateway.findDetail(id, schoolId)
}

/**
 * Accorde ou retire le niveau plateforme (`User.isSuperAdmin`). Les rôles d'école ne
 * passent pas par ici : ils vivent sur `SchoolMember` et se changent avec
 * `changeSchoolMemberRoleAction`.
 */
export async function changePlatformLevelAction(input: unknown) {
  const { userId } = await requirePlatformAdmin()

  const result = await changePlatformLevel(
    { id: userId },
    input as { id: string; isSuperAdmin: boolean }
  )
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function updateUserAction(input: unknown) {
  await requirePlatformAdmin()

  const result = await updateUser(
    input as { id: string; name?: string | null; email?: string; emailVerified?: boolean }
  )
  if (typeof result === 'string') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function deactivateUserAction(input: unknown) {
  const { userId } = await requirePlatformAdmin()

  const result = await deactivateUser({ id: userId }, input as { id: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function reactivateUserAction(input: unknown) {
  const { userId } = await requirePlatformAdmin()

  const result = await reactivateUser({ id: userId }, input as { id: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

// `id` vient de Better Auth : voir la note de `src/use-cases/users/schemas.ts`.
const deleteUserSchema = z.object({ id: z.string().min(1), confirmation: z.string().min(1) })

export async function deleteUserAction(input: unknown) {
  const { userId } = await requirePlatformAdmin()

  const parsed = deleteUserSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const target = await userGateway.findManaged(parsed.data.id)
  if (!target) return 'notFound' as const
  if (target.email.toLowerCase() !== parsed.data.confirmation.trim().toLowerCase()) {
    return 'confirmationMismatch' as const
  }

  const result = await deleteUser({ id: userId }, { id: parsed.data.id })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function revokeUserSessionsAction(input: unknown) {
  await requirePlatformAdmin()

  const result = await revokeUserSessions(input as { id: string })
  if (typeof result === 'string') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

const passwordResetSchema = z.object({ id: z.string().min(1) })

export async function sendPasswordResetAction(input: unknown) {
  await requirePlatformAdmin()

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

/**
 * Rattache une famille à un compte. La famille appartient à l'école active : le
 * `schoolId` vient du garde, jamais du client, et la clé étrangère composite de
 * `UserFamily` refuse une famille d'une autre école.
 */
export async function linkUserFamilyAction(input: unknown) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await linkUserFamily(schoolId, input as { id: string; familyId: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

export async function unlinkUserFamilyAction(input: unknown) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await unlinkUserFamily(schoolId, input as { id: string; familyId: string })
  if (result !== 'OK') return result

  revalidatePath(USERS_PATH)
  return 'OK' as const
}

const MemberIdSchema = z.object({ userId: z.string().min(1) })

/**
 * Retire une appartenance d'école. Réservé à un administrateur d'école : contrairement
 * à `deactivateUserAction`, ceci ne touche pas le compte plateforme.
 *
 * L'invariant anti-verrouillage — ne jamais retirer le dernier `ADMIN` d'une école —
 * est appliqué DANS la transaction du gateway. Le vérifier ici, avant l'appel,
 * laisserait deux retraits concurrents passer tous les deux.
 */
export async function removeSchoolMemberAction(userId: string) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = MemberIdSchema.safeParse({ userId })
  if (!parsed.success) return 'validation_error' as const

  try {
    return await schoolMemberGateway.removeMembership(parsed.data.userId, schoolId)
  } catch {
    return 'error' as const
  } finally {
    revalidatePath(USERS_PATH)
  }
}

const ChangeMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'PARENT']),
})

/**
 * L'invariant anti-verrouillage vit dans la transaction du gateway, pour la même
 * raison qu'au-dessus : une rétrogradation concurrente ne doit pas pouvoir vider
 * l'école de tout administrateur.
 */
export async function changeSchoolMemberRoleAction(userId: string, role: SchoolRole) {
  const { schoolId } = await requireSchoolAdmin()

  const parsed = ChangeMemberRoleSchema.safeParse({ userId, role })
  if (!parsed.success) return 'validation_error' as const

  try {
    return await schoolMemberGateway.changeMembershipRole(
      parsed.data.userId,
      schoolId,
      parsed.data.role
    )
  } catch {
    return 'error' as const
  } finally {
    revalidatePath(USERS_PATH)
  }
}
