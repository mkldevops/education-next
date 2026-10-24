export type AuthorizedSchool = {
  id: string
  name: string
  slug: string
  isAdmin: boolean
  /**
   * Lecture et saisie de tous les dossiers de l'école : un administrateur, ou un enseignant
   * quand l'école a ouvert `teacher_staff_access_enabled`. `isAdmin` implique `isStaff`.
   */
  isStaff: boolean
}

export type DeepLinkResolution<T> =
  | { status: 'found'; resource: T }
  | { status: 'otherSchool'; school: AuthorizedSchool }
  | { status: 'notFound' }

/**
 * Écoles interrogeables par une résolution de lien profond.
 *
 * `requireStaff` n'est pas décoratif : un utilisateur peut être `ADMIN` d'une école et
 * `PARENT` d'une autre. Sans ce filtre, un lien profond vers une page d'administration
 * de la seconde école deviendrait une élévation de privilège.
 */
export function reachableSchools(
  schools: AuthorizedSchool[],
  requireStaff: boolean
): AuthorizedSchool[] {
  return schools.filter((school) => !requireStaff || school.isStaff)
}

/**
 * Verdict sur une ressource déjà lue par une requête unique contrainte aux écoles
 * autorisées.
 *
 * Une école absente de `authorizedSchools` renvoie `notFound` et non `otherSchool` :
 * proposer une bascule révélerait l'existence de la ressource, ce que `AGENTS.md`
 * interdit. Ce cas ne peut survenir que si l'appelant a élargi la requête au-delà des
 * écoles autorisées — l'y ramener ici est la position fail-closed.
 */
export function classifyDeepLink<T extends { schoolId: string }>(
  resource: T | null,
  activeSchoolId: string,
  authorizedSchools: AuthorizedSchool[]
): DeepLinkResolution<T> {
  if (!resource) return { status: 'notFound' }
  if (resource.schoolId === activeSchoolId) return { status: 'found', resource }

  const school = authorizedSchools.find((candidate) => candidate.id === resource.schoolId)
  if (!school) return { status: 'notFound' }

  return { status: 'otherSchool', school }
}
