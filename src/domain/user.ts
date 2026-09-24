export type UserManagementFailure =
  | 'cannotTargetSelf'
  | 'lastSuperAdmin'
  | 'alreadyActive'
  | 'alreadyInactive'
  | 'stillActive'
  | 'hasRelatedRecords'

export type ManagedUser = {
  id: string
  isSuperAdmin: boolean
  isActive: boolean
}

export type Actor = {
  id: string
}

export function isLastActiveSuperAdmin(target: ManagedUser, activeSuperAdmins: number): boolean {
  return target.isSuperAdmin && target.isActive && activeSuperAdmins <= 1
}

export function checkPlatformLevelChange(
  actor: Actor,
  target: ManagedUser,
  nextIsSuperAdmin: boolean,
  activeSuperAdmins: number
): 'OK' | UserManagementFailure {
  if (actor.id === target.id) return 'cannotTargetSelf'
  if (!nextIsSuperAdmin && isLastActiveSuperAdmin(target, activeSuperAdmins)) {
    return 'lastSuperAdmin'
  }
  return 'OK'
}

export function checkDeactivation(
  actor: Actor,
  target: ManagedUser,
  activeSuperAdmins: number
): 'OK' | UserManagementFailure {
  if (actor.id === target.id) return 'cannotTargetSelf'
  if (!target.isActive) return 'alreadyInactive'
  if (isLastActiveSuperAdmin(target, activeSuperAdmins)) return 'lastSuperAdmin'
  return 'OK'
}

export function checkReactivation(actor: Actor, target: ManagedUser): 'OK' | UserManagementFailure {
  if (actor.id === target.id) return 'cannotTargetSelf'
  if (target.isActive) return 'alreadyActive'
  return 'OK'
}

export function checkDeletion(
  actor: Actor,
  target: ManagedUser,
  relatedRecords: number
): 'OK' | UserManagementFailure {
  if (actor.id === target.id) return 'cannotTargetSelf'
  if (target.isActive) return 'stillActive'
  if (relatedRecords > 0) return 'hasRelatedRecords'
  return 'OK'
}

export type ImpersonationFailure =
  | 'notSuperAdmin'
  | 'alreadyImpersonating'
  | 'cannotTargetSelf'
  | 'targetIsSuperAdmin'
  | 'targetInactive'

/**
 * Un super-admin emprunte l'identité d'un compte ordinaire, jamais celle d'un pair : la
 * session empruntée porterait les mêmes droits et brouillerait seulement la trace.
 * L'emprunt ne s'imbrique pas, le cookie de retour ne garde qu'une session d'origine.
 */
export function checkImpersonation(
  actor: ManagedUser,
  target: ManagedUser,
  isImpersonating: boolean
): 'OK' | ImpersonationFailure {
  if (!actor.isSuperAdmin || !actor.isActive) return 'notSuperAdmin'
  if (isImpersonating) return 'alreadyImpersonating'
  if (actor.id === target.id) return 'cannotTargetSelf'
  if (target.isSuperAdmin) return 'targetIsSuperAdmin'
  if (!target.isActive) return 'targetInactive'
  return 'OK'
}

/**
 * Refus opposé, pendant un emprunt, à toute opération sur les identifiants ou le compte
 * lui-même : passkey, adresse, mot de passe, comptes liés, sessions, clés API, suppression.
 * L'emprunt sert à voir ce que voit la cible, pas à s'installer durablement chez elle.
 */
export type ImpersonationLock = 'impersonating'

// Signature d'index : Better Auth type la session en `Record<string, any> & {...}`, qu'un
// objet aux seuls champs optionnels refuserait comme « weak type ».
type SessionWithImpersonation = {
  session: { [field: string]: unknown; impersonatedBy?: unknown }
}

/** Une session est empruntée dès qu'elle porte `impersonatedBy`, posé par le plugin. */
export function isImpersonating(session: SessionWithImpersonation | null | undefined): boolean {
  const impersonatedBy = session?.session.impersonatedBy
  return typeof impersonatedBy === 'string' && impersonatedBy.length > 0
}
