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
  /** Nom de la période : affiché dans une option seulement quand plusieurs périodes sont proposées. */
  periodName?: string
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
 * Libellé complet « CE1-A (CE1 — 2026-2027) » : bouton du sélecteur une fois la classe choisie et
 * récapitulatifs, là où ni titre de niveau ni liste ne donnent le contexte.
 */
export function classLabel(option: ClassOption): string {
  return withDetails(option.name, [option.levelName, option.periodName])
}

/**
 * Libellé d'une option de la liste : le niveau seulement quand aucun titre de niveau ne le donne
 * déjà, la période seulement quand plusieurs périodes sont proposées.
 */
export function classItemLabel(
  option: ClassOption,
  { showLevel, showPeriod }: { showLevel: boolean; showPeriod: boolean }
): string {
  return withDetails(option.name, [
    showLevel ? option.levelName : undefined,
    showPeriod ? option.periodName : undefined,
  ])
}

/** Vrai quand les classes proposées couvrent plus d'une période connue. */
export function spansSeveralPeriods(classes: ClassOption[]): boolean {
  return new Set(classes.map((c) => c.periodName).filter(Boolean)).size > 1
}

function withDetails(name: string, details: (string | undefined)[]): string {
  const known = details.filter(Boolean)
  return known.length > 0 ? `${name} (${known.join(' — ')})` : name
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
