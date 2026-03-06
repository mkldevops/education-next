'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function requireAdmin(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  })
  if (!dbUser) return null

  const rolesRaw = dbUser.roles
  const roles: string[] = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === 'string'
      ? JSON.parse(rolesRaw)
      : []
  if (!roles.includes('admin')) return null

  return session.user
}

export type SessionWithRole = {
  userId: string
  roles: string[]
  familyId?: string
}

export async function getSessionWithRole(): Promise<SessionWithRole> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/signin')

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  })
  if (!dbUser) redirect('/signin')

  const rolesRaw = dbUser.roles
  const roles: string[] = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === 'string'
      ? JSON.parse(rolesRaw)
      : []

  let familyId: string | undefined

  if (roles.includes('family')) {
    const userFamily = await db.userFamily.findFirst({
      where: { userId: session.user.id },
      select: { familyId: true },
    })
    familyId = userFamily?.familyId
  }

  return {
    userId: session.user.id,
    roles,
    familyId,
  }
}
