/**
 * Options du sélecteur d'élève du dialogue d'inscription. Module pur, partagé par le serveur
 * (projection) et le client (recherche) : aucune lecture ici. Les options de classe sont dans
 * `(dashboard)/_lib/class-options`.
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
