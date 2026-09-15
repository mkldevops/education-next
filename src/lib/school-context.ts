import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import type { AuthorizedSchool } from '@/domain/school-scope'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'

export const ACTIVE_SCHOOL_COOKIE = 'active_school'

export const ACTIVE_SCHOOL_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
} as const

/**
 * École active de la requête, déjà validée.
 *
 * Un super-admin n'a aucune ligne `SchoolMember` : sa branche porte `role: null` et
 * lui inventer `'ADMIN'` créerait une seconde source de vérité pour les rôles. Les
 * gardes d'autorisation traitent `isSuperAdmin: true` comme couvrant l'administration.
 *
 * `familyId` est nullable côté parent : une invitation `PARENT` peut ne porter aucune
 * famille, et le dépôt possède un parcours dédié pour ce cas.
 */
export type SchoolContext =
  | { userId: string; schoolId: string; isSuperAdmin: true; role: null }
  | { userId: string; schoolId: string; isSuperAdmin: false; role: 'ADMIN' }
  | {
      userId: string
      schoolId: string
      isSuperAdmin: false
      role: 'PARENT'
      familyId: string | null
    }

/**
 * Mémoïsé pour la durée d'un rendu : la résolution du contexte et celle des écoles
 * autorisées interrogent la même liste d'appartenances, et une page de détail les
 * demande toutes les deux.
 */
const listMemberships = cache((userId: string) => schoolMemberGateway.listAuthorizedSchools(userId))

type Membership = Awaited<ReturnType<typeof listMemberships>>[number]

/**
 * Appartenance retenue parmi celles de l'utilisateur.
 *
 * Le drapeau plateforme contraint aussi la LECTURE du cookie. Le refuser dans la seule
 * action laisserait la bascule accessible en éditant `active_school` à la main :
 * `httpOnly` interdit `document.cookie`, pas le panneau Application ni `curl`. Le
 * réglage n'est lu que lorsque le cookie changerait réellement l'école retenue, pour ne
 * pas ajouter une lecture aux requêtes qui n'en tirent rien.
 */
async function selectMembership(
  memberships: Membership[],
  requestedSchoolId: string | undefined
): Promise<Membership> {
  const fallback = memberships[0]
  const requested = memberships.find((candidate) => candidate.schoolId === requestedSchoolId)
  if (!requested || requested === fallback) return fallback

  return (await isSchoolSwitchEnabled()) ? requested : fallback
}

async function resolveSchoolContext(): Promise<SchoolContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return null

  // Relu en base à chaque requête : le `cookieCache` de Better Auth (5 min)
  // retarderait sinon toute révocation d'appartenance ou de compte.
  // `User` étant soumis au soft-delete, un compte désactivé ne renvoie rien.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  })
  if (!user) return null

  const requestedSchoolId = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value

  if (user.isSuperAdmin) {
    const requested = requestedSchoolId
      ? await schoolGateway.findActiveById(requestedSchoolId)
      : null
    const school = requested ?? (await schoolGateway.listActive())[0]
    if (!school) return null
    return { userId, schoolId: school.id, isSuperAdmin: true, role: null }
  }

  const memberships = await listMemberships(userId)
  if (memberships.length === 0) return null

  const membership = await selectMembership(memberships, requestedSchoolId)

  if (membership.role === 'ADMIN') {
    return { userId, schoolId: membership.schoolId, isSuperAdmin: false, role: 'ADMIN' }
  }

  const link = await db.userFamily.findFirst({
    where: { userId, schoolId: membership.schoolId },
    select: { familyId: true },
    // Ordre déterminé : l'ancien `findFirst` sans `orderBy` choisissait une famille
    // arbitraire pour un parent lié à plusieurs dossiers.
    orderBy: { familyId: 'asc' },
  })

  return {
    userId,
    schoolId: membership.schoolId,
    isSuperAdmin: false,
    role: 'PARENT',
    familyId: link?.familyId ?? null,
  }
}

/**
 * Mémoïsé pour la durée d'un rendu : les Server Components frères et
 * `generateMetadata` partagent la même résolution. Ce n'est pas un cache
 * inter-requêtes — la source reste la base, donc une révocation prend effet
 * dès la requête HTTP suivante.
 */
export const getSchoolContext = cache(resolveSchoolContext)

async function resolveAuthorizedSchools(): Promise<AuthorizedSchool[]> {
  const context = await getSchoolContext()
  if (!context) return []

  if (context.isSuperAdmin) {
    const schools = await schoolGateway.listActive()
    return schools.map((school) => ({ ...school, isAdmin: true }))
  }

  const memberships = await listMemberships(context.userId)
  return memberships.map(({ school, role }) => ({
    id: school.id,
    name: school.name,
    slug: school.slug,
    isAdmin: role === 'ADMIN',
  }))
}

/**
 * Écoles ouvertes à l'utilisateur courant, avec sa capacité sur chacune.
 *
 * Un super-admin n'a aucune appartenance : ses écoles sont toutes les écoles actives,
 * sans quoi il ne pourrait pas résoudre un lien profond vers une école qu'il vient de
 * créer. Un membre ordinaire ne voit que ses appartenances, et `isAdmin` est par école
 * — être administrateur de l'une n'administre pas l'autre.
 */
export const getAuthorizedSchools = cache(resolveAuthorizedSchools)

/** Capacité d'administration sur l'école active du contexte. */
export function isActiveSchoolAdmin(context: SchoolContext): boolean {
  return context.isSuperAdmin || context.role === 'ADMIN'
}
