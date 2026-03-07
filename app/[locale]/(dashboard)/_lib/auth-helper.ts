'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'

export async function requireAdmin(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser) return null
  if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') return null

  return session.user
}

export async function requireRole(allowedRoles: Role[]): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser) return null
  if (!allowedRoles.includes(dbUser.role)) return null

  return session.user
}

export type SessionWithRole = {
  userId: string
  role: Role
  familyId?: string
}

export async function getSessionWithRole(): Promise<SessionWithRole> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/signin')

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser) redirect('/signin')

  let familyId: string | undefined

  if (dbUser.role === 'PARENT') {
    const userFamily = await db.userFamily.findFirst({
      where: { userId: session.user.id },
      select: { familyId: true },
    })
    familyId = userFamily?.familyId
  }

  return {
    userId: session.user.id,
    role: dbUser.role,
    familyId,
  }
}
