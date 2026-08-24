import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const ACTIVE_SCHOOL_COOKIE = 'active_school'

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

  const memberships = await schoolMemberGateway.listAuthorizedSchools(userId)
  if (memberships.length === 0) return null

  const membership =
    memberships.find((candidate) => candidate.schoolId === requestedSchoolId) ?? memberships[0]

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
