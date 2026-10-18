/**
 * Options des sélecteurs d'élève et de classe des dialogues d'inscription. Module pur, partagé
 * par le serveur (projection) et le client (tri, affichage) : aucune lecture ici.
 */

export interface StudentOption {
  id: string
  name: string
  /** Nom de la famille, recherché comme le nom de l'élève. */
  familyName?: string
  /** Niveau suggéré pour la période cible, déduit du dernier niveau connu. */
  suggestedLevelId?: string | null
  /** Inscription en cours sur la période cible : la créer exige « Remplacer l'existante ». */
  enrolledInPeriod?: boolean
}

export interface ClassOption {
  id: string
  name: string
  levelId?: string
  capacity?: number
  /** Places occupées, même prédicat que `reserveClassSeats` (lecture hors verrou). */
  enrolled?: number
}

/** Places restantes, ou `null` quand la capacité n'est pas connue de l'appelant. */
export function remainingSeats(option: ClassOption): number | null {
  if (option.capacity === undefined || option.enrolled === undefined) return null
  return Math.max(0, option.capacity - option.enrolled)
}

export function isClassFull(option: ClassOption): boolean {
  return remainingSeats(option) === 0
}

/**
 * Classes du niveau suggéré d'abord, puis les autres ; dans chaque groupe, l'ordre reçu (par nom)
 * est conservé, les classes complètes en dernier. Sans niveau suggéré, tout va dans `others`.
 */
export function rankClasses(classes: ClassOption[], suggestedLevelId: string | null | undefined) {
  const byFullness = (list: ClassOption[]) => [
    ...list.filter((c) => !isClassFull(c)),
    ...list.filter((c) => isClassFull(c)),
  ]
  const suggested = suggestedLevelId ? classes.filter((c) => c.levelId === suggestedLevelId) : []
  const others = classes.filter((c) => !suggested.includes(c))

  return { suggested: byFullness(suggested), others: byFullness(others) }
}

/**
 * Niveau suggéré pour la période cible à partir de la dernière affectation connue de l'élève :
 * sur la période cible elle-même, son niveau ; sur une période antérieure, le niveau suivant
 * de la progression (`nextLevelId`), ou le même niveau en fin de chaîne. Sans affectation : aucun.
 */
export function suggestLevelId(
  lastAssignment: { levelId: string; nextLevelId: string | null; periodId: string } | null,
  targetPeriodId: string | null
): string | null {
  if (!lastAssignment) return null
  if (lastAssignment.periodId === targetPeriodId) return lastAssignment.levelId
  return lastAssignment.nextLevelId ?? lastAssignment.levelId
}

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Recherche sur le nom de l'élève et celui de sa famille, sans accents ni casse. */
export function matchesStudent(option: StudentOption, query: string) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  return normalizeSearch(`${option.name} ${option.familyName ?? ''}`).includes(needle)
}
