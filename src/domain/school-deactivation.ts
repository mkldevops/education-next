export type DeactivationBlockers = {
  pendingEnrollments: number
  pendingTransactions: number
  pendingInvitations: number
}

export type DeactivationVerdict =
  | { status: 'OK' }
  | { status: 'lastActiveSchool' }
  | { status: 'schoolInUse'; blockers: DeactivationBlockers }

/**
 * Verdict sur la désactivation d'une école, à partir de deux comptages déjà lus.
 *
 * L'ordre n'est pas arbitraire : désactiver la dernière école active est le seul
 * refus dont l'inverse est irrattrapable. `getSchoolContext()` ne résoudrait plus
 * aucune école, tout le dashboard répondrait `notFound()` — `/dashboard/schools`
 * compris — et la réactivation deviendrait inatteignable. Ce cas passe donc avant
 * l'énumération des blocages métier, qui, eux, se résolvent.
 */
export function classifySchoolDeactivation(
  activeSchoolCount: number,
  blockers: DeactivationBlockers
): DeactivationVerdict {
  if (activeSchoolCount <= 1) return { status: 'lastActiveSchool' }

  const blocked =
    blockers.pendingEnrollments > 0 ||
    blockers.pendingTransactions > 0 ||
    blockers.pendingInvitations > 0

  return blocked ? { status: 'schoolInUse', blockers } : { status: 'OK' }
}
