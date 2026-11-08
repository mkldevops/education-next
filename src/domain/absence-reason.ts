export const ABSENCE_REASON_LABEL_MAX = 80

/** Reasons created with a school, and backfilled by the migration that introduced them. */
export const DEFAULT_ABSENCE_REASONS = [
  { label: 'Maladie', justified: true },
  { label: 'Rendez-vous médical', justified: true },
  { label: 'Raison familiale', justified: true },
  { label: 'Sans nouvelles', justified: false },
] as const

/** Collapses inner whitespace so « Maladie » and « Maladie  » are the same reason. */
export function normalizeAbsenceReasonLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

export function sameAbsenceReasonLabel(a: string, b: string): boolean {
  return (
    normalizeAbsenceReasonLabel(a).toLocaleLowerCase('fr') ===
    normalizeAbsenceReasonLabel(b).toLocaleLowerCase('fr')
  )
}

/** Absent students without a reason: they block validation when the school requires one. */
export function countMissingAbsenceReasons(
  entries: readonly { status: string; absenceReasonId: string | null }[]
): number {
  return entries.filter((entry) => entry.status === 'ABSENT' && !entry.absenceReasonId).length
}
