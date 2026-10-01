import type { DeepLinkResolution } from '@/domain/school-scope'
import { classifyDeepLink, reachableSchools } from '@/domain/school-scope'
import { getAuthorizedSchools, getSchoolContext } from '@/lib/school-context'

/**
 * Écoles interrogeables par une résolution, et l'identité qui les ouvre.
 *
 * `schoolIds` va dans le `schoolId: { in: ... }` de la racine — c'est lui qui satisfait
 * le garde tenant. `adminSchoolIds` en est le sous-ensemble administré, utilisé par
 * `adminOrLinkedTo` pour n'ouvrir une ressource que sur une capacité réelle.
 */
export type DeepLinkAccess = {
  userId: string
  schoolIds: string[]
  adminSchoolIds: string[]
}

/**
 * Résolution d'un lien profond en **une seule** requête.
 *
 * Le scope par cookie implique qu'un lien partagé n'emporte pas son contexte d'école.
 * Plutôt qu'une lecture non scopée par `id` seul suivie d'un contrôle, `find` reçoit
 * les écoles autorisées et les pose sur la racine : la requête ne peut structurellement
 * pas voir une école tierce.
 *
 * `generateMetadata` doit appeler ce résolveur via le même symbole `React.cache()` que
 * la page, afin qu'aucun lookup par `id` seul ne subsiste et que la requête ne soit
 * jouée qu'une fois par rendu.
 */
export async function resolveDeepLink<T extends { schoolId: string }>(options: {
  requireAdmin: boolean
  find: (access: DeepLinkAccess) => Promise<T | null>
}): Promise<DeepLinkResolution<T>> {
  const context = await getSchoolContext()
  if (!context) return { status: 'notFound' }

  const authorized = await getAuthorizedSchools()
  const reachable = reachableSchools(authorized, options.requireAdmin)
  if (reachable.length === 0) return { status: 'notFound' }

  const resource = await options.find({
    userId: context.userId,
    schoolIds: reachable.map((school) => school.id),
    adminSchoolIds: reachable.filter((school) => school.isAdmin).map((school) => school.id),
  })

  return classifyDeepLink(resource, context.schoolId, reachable)
}

/**
 * « Administrateur de l'école qui porte la ressource, **ou** rattaché à ce dossier ».
 *
 * La capacité est par école : un `ADMIN` de A qui est `PARENT` de B ne doit lire de B
 * que ce qui le concerne. Le `OR` est imbriqué sous un `schoolId` de racine déjà posé
 * par `schoolIds`, donc le garde tenant reste satisfait et la requête reste unique.
 */
export function adminOrLinkedTo<W extends object>(
  access: DeepLinkAccess,
  linkedToViewer: W
): { OR: ({ schoolId: { in: string[] } } | W)[] } {
  return { OR: [{ schoolId: { in: access.adminSchoolIds } }, linkedToViewer] }
}

/**
 * Rattachements `FamilyPerson` que le lecteur a le droit de voir, à poser en `where`
 * sur un `include` de `person.families`.
 *
 * Le garde de racine n'ouvre que la fiche : il ne contraint pas ses inclusions. Un
 * élève en garde alternée est rattaché à deux foyers, et sans ce filtre le parent
 * de l'un lisait les coordonnées de l'autre — celui que Postgres rendait en premier.
 * Un administrateur de l'école voit tous les rattachements ; un parent ne voit que
 * les familles auxquelles son compte est lié.
 */
export function familyLinksVisibleTo(access: DeepLinkAccess) {
  return adminOrLinkedTo(access, { family: { users: { some: { userId: access.userId } } } })
}
