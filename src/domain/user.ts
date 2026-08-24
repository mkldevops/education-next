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
