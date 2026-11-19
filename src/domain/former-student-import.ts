import { rosterPersonKey } from './roster-import'

/**
 * Import d'une liste d'anciens élèves lue par l'IA : l'école relit chaque ligne, rien n'est écrit
 * avant sa confirmation. Ces règles sont pures ; le cas d'usage fournit les élèves existants.
 */

export const FORMER_STUDENT_IMPORT_LIMITS = {
  maxFiles: 4,
  /** Par fichier, avant conversion : une photo est réduite côté navigateur avant l'envoi. */
  maxFileBytes: 6 * 1024 * 1024,
  /** Tous fichiers confondus, sous le plafond de 11 Mo du corps d'une action serveur. */
  maxTotalBytes: 10 * 1024 * 1024,
  /** Texte envoyé au modèle pour un CSV, un TXT ou un classeur converti. */
  maxTextChars: 200_000,
  maxRows: 500,
  maxNameLength: 250,
  maxClassLabelLength: 100,
} as const

export const FORMER_STUDENT_FIELDS = [
  'lastname',
  'firstname',
  'birthday',
  'className',
  'departureYear',
] as const

export type FormerStudentField = (typeof FORMER_STUDENT_FIELDS)[number]

/** Une ligne telle que l'école la relit et la corrige ; les champs vides sont des chaînes vides. */
export type FormerStudentDraft = {
  id: string
  lastname: string
  firstname: string
  /** `YYYY-MM-DD`, ou vide si inconnue. */
  birthday: string
  className: string
  /** `YYYY`, ou vide si inconnue. */
  departureYear: string
  /** Décochée, la ligne n'est ni comptée ni importée. */
  included: boolean
  /** Champs que l'IA n'a pas lus avec certitude. */
  uncertain: FormerStudentField[]
}

export type FormerStudentStatus = 'create' | 'existing' | 'homonym' | 'incomplete'

type FormerStudentIssue =
  | 'missingName'
  | 'nameTooLong'
  | 'classTooLong'
  | 'invalidBirthday'
  | 'invalidYear'
  | 'duplicateInFile'

export type FormerStudentPreviewRow = {
  id: string
  status: FormerStudentStatus
  issues: FormerStudentIssue[]
}

/** Un élève déjà connu de l'école, actif ou archivé. */
export type ExistingStudent = {
  lastname: string
  firstname: string
  /** `YYYY-MM-DD`, ou `null` si inconnue. */
  birthday: string | null
  isActive: boolean
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MIN_BIRTH_YEAR = 1900
const MIN_DEPARTURE_YEAR = 1950

/** Date ISO réelle (pas de 31 février), entre 1900 et aujourd'hui. */
export function isValidBirthday(value: string, now: Date) {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return false
  if (date.getUTCDate() !== day) return false
  return year >= MIN_BIRTH_YEAR && date.getTime() <= now.getTime()
}

/** Année sur quatre chiffres, entre 1950 et l'année en cours. */
export function isValidDepartureYear(value: string, now: Date) {
  if (!/^\d{4}$/.test(value)) return false
  const year = Number(value)
  return year >= MIN_DEPARTURE_YEAR && year <= now.getUTCFullYear()
}

/**
 * Date de départ enregistrée. Une année de départ devient le 31 août de cette année, fin de
 * l'année scolaire qui s'y achève ; sans année, ou si ce 31 août n'est pas encore passé, c'est
 * le moment de l'import.
 */
export function formerStudentLeftAt(departureYear: string, now: Date) {
  if (!departureYear) return now
  const endOfSchoolYear = new Date(Date.UTC(Number(departureYear), 7, 31))
  return endOfSchoolYear.getTime() < now.getTime() ? endOfSchoolYear : now
}

function rowIssues(row: FormerStudentDraft, now: Date): FormerStudentIssue[] {
  const issues: FormerStudentIssue[] = []
  const { maxNameLength, maxClassLabelLength } = FORMER_STUDENT_IMPORT_LIMITS
  if (!row.lastname.trim() || !row.firstname.trim()) issues.push('missingName')
  if (row.lastname.trim().length > maxNameLength || row.firstname.trim().length > maxNameLength) {
    issues.push('nameTooLong')
  }
  if (row.className.trim().length > maxClassLabelLength) issues.push('classTooLong')
  if (row.birthday && !isValidBirthday(row.birthday, now)) issues.push('invalidBirthday')
  if (row.departureYear && !isValidDepartureYear(row.departureYear, now)) {
    issues.push('invalidYear')
  }
  return issues
}

const personKey = (person: { lastname: string; firstname: string }) =>
  rosterPersonKey({ lastname: person.lastname, name: person.firstname })

/**
 * Statut de chaque ligne. Une ligne qui retrouve un élève déjà archivé de même nom (et de même
 * date de naissance quand les deux sont connues) est `existing` et ignorée : rejouer un import
 * ne crée donc rien de plus. Un élève actif de même nom n'est le même que si les deux dates de
 * naissance sont connues et égales ; sinon la ligne est un `homonym`, créée mais signalée.
 * Une ligne décochée garde un statut pour l'affichage mais n'entre pas dans les doublons.
 */
export function classifyFormerStudents(
  rows: FormerStudentDraft[],
  existing: ExistingStudent[],
  now: Date
): FormerStudentPreviewRow[] {
  const existingByKey = new Map<string, ExistingStudent[]>()
  for (const student of existing) {
    const key = personKey(student)
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), student])
  }
  const seen = new Map<string, (string | null)[]>()

  return rows.map((row) => {
    const issues = rowIssues(row, now)
    if (issues.length > 0) return { id: row.id, status: 'incomplete', issues }

    const key = personKey(row)
    const birthday = row.birthday || null
    const sameBirthday = (other: string | null) =>
      birthday === null || other === null || birthday === other

    if (row.included) {
      const earlier = seen.get(key) ?? []
      if (earlier.some(sameBirthday)) {
        return { id: row.id, status: 'existing', issues: ['duplicateInFile'] }
      }
      seen.set(key, [...earlier, birthday])
    }

    const matches = existingByKey.get(key) ?? []
    const isSame = (student: ExistingStudent) =>
      student.isActive
        ? birthday !== null && student.birthday === birthday
        : sameBirthday(student.birthday)
    if (matches.some(isSame)) return { id: row.id, status: 'existing', issues: [] }
    if (matches.length > 0) return { id: row.id, status: 'homonym', issues: [] }
    return { id: row.id, status: 'create', issues: [] }
  })
}

/** Lignes que « Importer N élèves » écrirait : cochées, à créer ou homonymes. */
export function isImportable(row: FormerStudentDraft, preview: FormerStudentPreviewRow) {
  return row.included && (preview.status === 'create' || preview.status === 'homonym')
}

/** Compteurs des pastilles de synthèse, sur les seules lignes cochées. */
export function countFormerStudentStatuses(
  rows: FormerStudentDraft[],
  preview: FormerStudentPreviewRow[]
) {
  const counts: Record<FormerStudentStatus, number> = {
    create: 0,
    existing: 0,
    homonym: 0,
    incomplete: 0,
  }
  const statusById = new Map(preview.map((row) => [row.id, row.status]))
  for (const row of rows) {
    const status = statusById.get(row.id)
    if (row.included && status) counts[status] += 1
  }
  return counts
}

/** Libellé de classe tel qu'enregistré : espaces resserrés, vide devenu `null`. */
export function formerClassLabel(value: string) {
  const label = value.replace(/\s+/g, ' ').trim()
  return label === '' ? null : label
}

/** Une lecture au-delà de 500 lignes est tronquée : l'école importe le reste ensuite. */
export function capFormerStudentRows<T>(rows: T[]) {
  const { maxRows } = FORMER_STUDENT_IMPORT_LIMITS
  return { rows: rows.slice(0, maxRows), truncated: rows.length > maxRows }
}
