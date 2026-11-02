import { notFound, redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { localizedHref } from '@/i18n/localized-href'
import { db } from '@/lib/db'
import type { SchoolContext } from '@/lib/school-context'
import {
  getSchoolContext,
  hasActiveSchoolStaffAccess,
  hasSchoolRole,
  isActiveSchoolAdmin,
} from '@/lib/school-context'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'

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
  if (!isActiveSchoolAdmin(context)) notFound()

  return { schoolId: context.schoolId, userId: context.userId, isSuperAdmin: context.isSuperAdmin }
}

/**
 * Portée caisse sur l'école active : l'administration, ou un membre `CASHIER`, et seulement
 * si l'école a ouvert les repas. `isAdmin` garde l'annulation, les ajustements, les tarifs et
 * les fermetures à l'administration.
 */
export async function requireSchoolCashier(): Promise<{
  schoolId: string
  userId: string
  isAdmin: boolean
}> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!(await canOpenSchoolCashier(context))) notFound()

  return {
    schoolId: context.schoolId,
    userId: context.userId,
    isAdmin: isActiveSchoolAdmin(context),
  }
}

export async function canOpenSchoolCashier(context: SchoolContext): Promise<boolean> {
  if (!isActiveSchoolAdmin(context) && !hasSchoolRole(context, 'CASHIER')) return false

  return isMealsEnabled(context.schoolId)
}

/**
 * Portée « staff » sur l'école active : l'administration, ou un enseignant quand l'école a
 * ouvert `teacher_staff_access_enabled`. Elle couvre familles, élèves, inscriptions et la
 * lecture des classes ; `isAdmin` reste le seul passage vers les paiements, les formules et
 * les opérations réservées (suppression définitive, comptes, remises).
 */
export async function requireSchoolStaff(): Promise<{
  schoolId: string
  userId: string
  isAdmin: boolean
}> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()
  if (!(await hasActiveSchoolStaffAccess(context))) notFound()

  return {
    schoolId: context.schoolId,
    userId: context.userId,
    isAdmin: isActiveSchoolAdmin(context),
  }
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
 * L'administration l'emporte : un admin-parent lit l'école entière, ce que son rôle `ADMIN`
 * lui ouvre déjà ailleurs.
 *
 * `familyId` est ici une chaîne, pas `string | null` : ses appelants l'injectent dans
 * des filtres Prisma sur une colonne non nullable. Un parent sans famille est donc
 * arrêté ici. Les surfaces qui doivent l'accueillir — l'écran « parent non rattaché »
 * — appellent `getSchoolContext()` directement.
 */
export async function requireSchoolScope(): Promise<SchoolScope> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()

  if (isActiveSchoolAdmin(context)) {
    return { schoolId: context.schoolId, userId: context.userId, isAdmin: true }
  }

  // `familyId` n'existe que pour un membre `PARENT` : un enseignant-parent reçoit ici sa
  // portée parent, un enseignant seul est refusé comme avant.
  if (!context.familyId) notFound()

  return {
    schoolId: context.schoolId,
    userId: context.userId,
    isAdmin: false,
    familyId: context.familyId,
  }
}

export type SchoolRecordsScope =
  | { schoolId: string; userId: string; isStaff: true; isAdmin: boolean }
  | { schoolId: string; userId: string; isStaff: false; isAdmin: false; familyId: string }

/**
 * Portée des listes familles, élèves et inscriptions : `requireSchoolScope()` élargi au
 * staff. Un enseignant à accès élargi y lit toute l'école avec `isAdmin: false`, que ces
 * pages traduisent en « sans finances ». Les autres pages gardent `requireSchoolScope()`,
 * qui continue de refuser tout enseignant.
 */
export async function requireSchoolRecordsScope(): Promise<SchoolRecordsScope> {
  const context = await getSchoolContext()
  if (!context) return redirectToLogin()

  if (await hasActiveSchoolStaffAccess(context)) {
    return {
      schoolId: context.schoolId,
      userId: context.userId,
      isStaff: true,
      isAdmin: isActiveSchoolAdmin(context),
    }
  }

  const scope = await requireSchoolScope()
  if (scope.isAdmin) notFound()

  return { ...scope, isStaff: false }
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
