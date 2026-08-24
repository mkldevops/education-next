'use server'

import { notFound, redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { localizedHref } from '@/i18n/localized-href'
import { getSchoolContext } from '@/lib/school-context'

async function redirectToLogin(): Promise<never> {
  const locale = await getLocale()
  redirect(localizedHref(locale, '/login'))
}

/**
 * Portée d'administration sur l'école active. Un `isSuperAdmin` la couvre sans
 * posséder de ligne `SchoolMember`.
 */
export async function requireSchoolAdmin(): Promise<{ schoolId: string; userId: string }> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!context.isSuperAdmin && context.role !== 'ADMIN') notFound()

  return { schoolId: context.schoolId, userId: context.userId }
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

  if (!context.familyId) notFound()

  return {
    schoolId: context.schoolId,
    userId: context.userId,
    isAdmin: false,
    familyId: context.familyId,
  }
}

/** Portée plateforme : gestion des écoles et des comptes, hors de toute école. */
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!context.isSuperAdmin) notFound()

  return { userId: context.userId }
}
