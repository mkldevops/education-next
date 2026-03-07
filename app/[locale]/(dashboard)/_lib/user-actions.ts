'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'
import { requireAdmin } from './auth-helper'

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
