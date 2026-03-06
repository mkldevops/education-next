'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { requireAdmin } from './auth-helper'

export async function createUserAction(data: {
  name: string
  email: string
  password: string
  role: 'admin' | 'family'
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
        roles: JSON.stringify([data.role]),
        emailVerified: true,
      },
    })

    revalidatePath('/dashboard')
    return { id: res.user.id, email: data.email }
  } catch {
    return 'error' as const
  }
}
