import { notFound, redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { localizedHref } from '@/i18n/localized-href'
import { db } from '@/lib/db'
import type { SchoolContext } from '@/lib/school-context'
import { getSchoolContext } from '@/lib/school-context'

async function redirectToLogin(): Promise<never> {
  const locale = await getLocale()
  redirect(localizedHref(locale, '/login'))
}

/**
 * Portée d'administration sur l'école active. Un `isSuperAdmin` la couvre sans
 * posséder de ligne `SchoolMember`.
 */
export async function requireSchoolAdmin(): Promise<{
  schoolId: string
  userId: string
  isSuperAdmin: boolean
}> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!context.isSuperAdmin && context.role !== 'ADMIN') notFound()

  return { schoolId: context.schoolId, userId: context.userId, isSuperAdmin: context.isSuperAdmin }
}

/**
 * Session authentifiée et école active, sans exiger de capacité.
 *
 * Les pages de détail passent par ici plutôt que par `requireSchoolScope()` : leur
 * autorisation est portée par la requête de résolution de lien profond, qui doit
 * pouvoir regarder au-delà de l'école active. Exiger la capacité sur l'école active
 * renverrait `notFound()` avant même que la bascule puisse être proposée.
 */
export async function requireSchoolSession(): Promise<SchoolContext> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()

  return context
}

export type SchoolScope =
  | { schoolId: string; userId: string; isAdmin: true }
  | { schoolId: string; userId: string; isAdmin: false; familyId: string }

/**
 * Portée de lecture métier.
 *
 * `familyId` est ici une chaîne, pas `string | null` : ses appelants l'injectent dans
 * des filtres Prisma sur une colonne non nullable. Un parent sans famille est donc
 * arrêté ici. Les surfaces qui doivent l'accueillir — l'écran « parent non rattaché »
 * — appellent `getSchoolContext()` directement.
 */
export async function requireSchoolScope(): Promise<SchoolScope> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()

  if (context.isSuperAdmin) {
    return { schoolId: context.schoolId, userId: context.userId, isAdmin: true }
  }
  if (context.role === 'ADMIN') {
    return { schoolId: context.schoolId, userId: context.userId, isAdmin: true }
  }

  if (context.role !== 'PARENT' || !context.familyId) notFound()

  return {
    schoolId: context.schoolId,
    userId: context.userId,
    isAdmin: false,
    familyId: context.familyId,
  }
}

/**
 * Enseignant lié au compte courant dans l'école active.
 *
 * Le rôle SchoolMember reste la source des privilèges d'administration ou parentaux.
 * Une fiche `Teacher` liée est une capacité additionnelle : un ADMIN ou un PARENT
 * peut donc consulter ses propres classes sans acquérir (ni céder) d'autres droits.
 */
export async function requireTeacher(): Promise<{
  schoolId: string
  userId: string
  teacherId: string
}> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()

  const teacher = await db.teacher.findFirst({
    where: { schoolId: context.schoolId, userId: context.userId, isActive: true },
    select: { id: true },
  })
  if (!teacher) notFound()
  return { schoolId: context.schoolId, userId: context.userId, teacherId: teacher.id }
}

/** Portée plateforme : gestion des écoles et des comptes, hors de toute école. */
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!context.isSuperAdmin) notFound()

  return { userId: context.userId }
}
