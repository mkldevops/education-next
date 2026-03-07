'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'
import { requireAdmin, requireRole } from './auth-helper'

export async function createUserAction(data: {
  name: string
  email: string
  password: string
  role: Role
}) {
  const admin = await requireAdmin()
  if (!admin) return 'unauthorized' as const

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

const ChangeUserRoleSchema = z.object({
  userId: z.string().cuid(),
  newRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'PARENT']),
})

export async function changeUserRoleAction(data: unknown) {
  const user = await requireRole(['SUPER_ADMIN'])
  if (!user) return 'unauthorized' as const

  const parsed = ChangeUserRoleSchema.safeParse(data)
  if (!parsed.success) return 'validation_error' as const

  try {
    await db.user.update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.newRole as Role },
    })

    revalidatePath('/dashboard/users')
    return 'OK'
  } catch {
    return 'error' as const
  }
}

const DeactivateUserSchema = z.object({
  userId: z.string().cuid(),
})

export async function deactivateUserAction(data: unknown) {
  const user = await requireRole(['SUPER_ADMIN'])
  if (!user) return 'unauthorized' as const

  const parsed = DeactivateUserSchema.safeParse(data)
  if (!parsed.success) return 'validation_error' as const

  try {
    await db.user.update({
      where: { id: parsed.data.userId },
      data: { isActive: false },
    })

    revalidatePath('/dashboard/users')
    return 'OK'
  } catch {
    return 'error' as const
  }
}
