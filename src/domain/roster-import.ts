/**
 * Import d'une liste de classe (`nom;prenom;classe`), une fois par école à la rentrée.
 * Rien ici ne lit la base : le script fournit l'existant et applique le plan rendu.
 */

export type RosterRow = { line: number; lastname: string; name: string; className: string }

export type RosterClass = { id: string; name: string; capacity: number; enrolled: number }

export type RosterExisting = { lastname: string; name: string; className: string }

/** Casse, accents et espaces ne distinguent pas deux élèves. */
export function normalizeRosterText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export const rosterPersonKey = (person: { lastname: string; name: string }) =>
  JSON.stringify([normalizeRosterText(person.lastname), normalizeRosterText(person.name)])

const rosterKey = (row: { lastname: string; name: string; className: string }) =>
  JSON.stringify([rosterPersonKey(row), normalizeRosterText(row.className)])

/**
 * Lignes lisibles et lignes refusées (colonne vide ou manquante). Une première ligne
 * `nom;prenom;classe` est un en-tête, pas un élève.
 */
export function parseRosterCsv(text: string) {
  const rows: RosterRow[] = []
  const invalid: number[] = []
  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === '') return
    const cells = raw.split(';').map((cell) => cell.trim())
    if (index === 0 && normalizeRosterText(cells[0] ?? '') === 'nom') return
    const [lastname, name, className] = cells
    if (cells.length !== 3 || !lastname || !name || !className) {
      invalid.push(index + 1)
      return
    }
    rows.push({ line: index + 1, lastname, name, className })
  })
  return { rows, invalid }
}

/**
 * Ce que l'import créerait. Un élève déjà inscrit dans la même classe est ignoré, ce qui
 * rend l'import rejouable ; un doublon dans le fichier aussi. Une classe inconnue ou une
 * classe que l'import ferait déborder bloque l'écriture. Les familles ne sont jamais
 * déduites : un même nom de famille est seulement signalé, l'école tranche.
 */
export function planRosterImport(
  rows: RosterRow[],
  classes: RosterClass[],
  existing: RosterExisting[]
) {
  const classByName = new Map(classes.map((item) => [normalizeRosterText(item.name), item]))
  const seen = new Set(existing.map(rosterKey))
  const create: Array<RosterRow & { classPeriodId: string }> = []
  const skipped: RosterRow[] = []
  const unknownClass: RosterRow[] = []

  for (const row of rows) {
    const target = classByName.get(normalizeRosterText(row.className))
    if (!target) {
      unknownClass.push(row)
      continue
    }
    const key = rosterKey({ ...row, className: target.name })
    if (seen.has(key)) {
      skipped.push(row)
      continue
    }
    seen.add(key)
    create.push({ ...row, className: target.name, classPeriodId: target.id })
  }

  const classesByPerson = new Map<string, Set<string>>()
  for (const entry of [...existing, ...rows]) {
    const key = rosterPersonKey(entry)
    const names = classesByPerson.get(key) ?? new Set<string>()
    names.add(normalizeRosterText(entry.className))
    classesByPerson.set(key, names)
  }
  const conflictingClasses = rows.filter(
    (row) => (classesByPerson.get(rosterPersonKey(row))?.size ?? 0) > 1
  )

  const overCapacity = classes
    .map((item) => ({
      name: item.name,
      capacity: item.capacity,
      total: item.enrolled + create.filter((row) => row.classPeriodId === item.id).length,
    }))
    .filter((item) => item.total > item.capacity)

  const families = new Map<string, Set<string>>()
  for (const student of [...existing, ...create]) {
    const lastname = normalizeRosterText(student.lastname)
    const names = families.get(lastname) ?? new Set<string>()
    names.add(`${student.name.trim()} (${student.className})`)
    families.set(lastname, names)
  }
  const sameLastname = [...families]
    .filter(([, names]) => names.size > 1)
    .map(([lastname, names]) => ({ lastname, students: [...names].sort() }))
    .sort((a, b) => a.lastname.localeCompare(b.lastname))

  return { create, skipped, unknownClass, overCapacity, sameLastname, conflictingClasses }
}

export type RosterPerson = {
  id: string
  lastname: string
  name: string
  isActive: boolean
  student: { id: string; isActive: boolean } | null
  hasActiveFamily: boolean
}

/** Resolve full names only; shared surnames alone never establish a family relationship. */
export function resolveRosterPeople(rows: RosterRow[], people: RosterPerson[]) {
  const byName = new Map<string, RosterPerson[]>()
  for (const person of people) {
    const name = rosterPersonKey(person)
    byName.set(name, [...(byName.get(name) ?? []), person])
  }
  return rows.map((row) => {
    const matches = byName.get(rosterPersonKey(row)) ?? []
    if (matches.length > 1) return { row, kind: 'ambiguous' as const }
    const person = matches[0]
    if (person && (!person.isActive || (person.student && !person.student.isActive))) {
      return { row, kind: 'archived' as const }
    }
    return { row, kind: 'resolved' as const, person }
  })
}

/** An open enrollment with an ended assignment still belongs to the period. */
export function findOpenEnrollmentConflicts(rows: RosterRow[], assigned: RosterExisting[]) {
  const names = new Set(assigned.map(rosterPersonKey))
  return rows.filter((row) => names.has(rosterPersonKey(row)))
}
