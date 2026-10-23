import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, HandCoins, UserPlus, UsersRound } from 'lucide-react'
import { flattenNavItems, type NavScope, resolveNavItems } from './sidebar-items'

export type PaletteAction = {
  /** Clé de traduction sous `search.actions`. */
  key: 'newFamily' | 'newEnrollment' | 'takeAttendance' | 'reviewBalances'
  href: string
  icon: LucideIcon
}

/**
 * Raccourcis de la palette ⌘K. Ils ne font qu'ouvrir une page déjà protégée côté serveur : les
 * proposer à un rôle qui ne peut pas les exécuter ne ferait que mener à un refus. Ils suivent donc
 * la même visibilité que la barre latérale, plus le rôle d'administration pour les créations.
 */
export function resolvePaletteActions(scope: NavScope): PaletteAction[] {
  const visible = new Set(flattenNavItems(resolveNavItems(scope)).map((item) => item.key))
  const isAdmin = scope.isSuperAdmin || scope.roles.includes('ADMIN')
  // Un enseignant à accès élargi crée familles et inscriptions, jamais de règlement.
  const canManage = isAdmin || (scope.roles.includes('TEACHER') && scope.hasStaffAccess === true)

  const actions: PaletteAction[] = []
  if (canManage && visible.has('families')) {
    actions.push({ key: 'newFamily', href: '/dashboard/families?action=create', icon: UserPlus })
  }
  if (canManage && visible.has('enrollments')) {
    actions.push({
      key: 'newEnrollment',
      href: '/dashboard/enrollments?action=create',
      icon: UsersRound,
    })
  }
  if (visible.has('attendance')) {
    actions.push({ key: 'takeAttendance', href: '/dashboard/attendance', icon: ClipboardCheck })
  }
  if (isAdmin && visible.has('payments')) {
    actions.push({ key: 'reviewBalances', href: '/dashboard/payments', icon: HandCoins })
  }
  return actions
}

/** Comparaison insensible à la casse et aux accents, pour filtrer les entrées statiques. */
export function matchesQuery(label: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const needle = normalize(query.trim())
  return needle === '' || normalize(label).includes(needle)
}
