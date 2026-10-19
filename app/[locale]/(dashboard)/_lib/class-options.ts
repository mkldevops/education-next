/**
 * Options du sélecteur de classe partagé par les dialogues d'inscription, d'élève et de famille.
 * Module pur, partagé par le serveur (projection) et le client (tri, affichage) : aucune lecture ici.
 */

export interface ClassOption {
  id: string
  name: string
  levelId?: string
  /** Nom du niveau : sans niveau suggéré, les classes sont regroupées par niveau. */
  levelName?: string
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

const byFullness = (list: ClassOption[]) => [
  ...list.filter((c) => !isClassFull(c)),
  ...list.filter((c) => isClassFull(c)),
]

/**
 * Classes du niveau suggéré d'abord, puis les autres ; dans chaque groupe, l'ordre reçu (par nom)
 * est conservé, les classes complètes en dernier. Sans niveau suggéré, tout va dans `others`.
 */
export function rankClasses(classes: ClassOption[], suggestedLevelId: string | null | undefined) {
  const suggested = suggestedLevelId ? classes.filter((c) => c.levelId === suggestedLevelId) : []
  const others = classes.filter((c) => !suggested.includes(c))

  return { suggested: byFullness(suggested), others: byFullness(others) }
}

/**
 * Classes regroupées par niveau, niveaux triés par nom ; dans chaque niveau, l'ordre reçu est
 * conservé, les classes complètes en dernier. Vide quand une classe n'a pas de nom de niveau :
 * l'appelant garde alors la liste à plat.
 */
export function groupClassesByLevel(classes: ClassOption[]) {
  if (classes.length === 0 || classes.some((c) => !c.levelName)) return []

  const groups = new Map<string, ClassOption[]>()
  for (const option of classes) {
    const key = option.levelName as string
    groups.set(key, [...(groups.get(key) ?? []), option])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([levelName, list]) => ({ levelName, classes: byFullness(list) }))
}

/**
 * Niveau suggéré pour la période cible à partir de la dernière affectation connue de l'élève :
 * sur la période cible elle-même, son niveau ; sur une période antérieure, l'unique niveau
 * suivant de la progression, ou le même niveau en fin de chaîne. Quand la progression se divise,
 * aucun niveau n'est suggéré : le choix revient à l'administrateur. Sans affectation : aucun.
 */
export function suggestLevelId(
  lastAssignment: { levelId: string; nextLevelIds: readonly string[]; periodId: string } | null,
  targetPeriodId: string | null
): string | null {
  if (!lastAssignment) return null
  if (lastAssignment.periodId === targetPeriodId) return lastAssignment.levelId

  const { nextLevelIds } = lastAssignment
  if (nextLevelIds.length > 1) return null
  return nextLevelIds[0] ?? lastAssignment.levelId
}
