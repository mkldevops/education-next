import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutGrid,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { SchoolRole } from '@/types/enums'

export type NavItemConfig = {
  href: string
  icon: LucideIcon
  key: string
  requiredRoles?: SchoolRole[]
  /** Surface plateforme : réservée à `isSuperAdmin`, qu'aucun rôle d'école ne couvre. */
  platformOnly?: true
}

const gestionItems: NavItemConfig[] = [
  { href: '/dashboard', icon: LayoutGrid, key: 'dashboard' },
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments' },
]

const configItems: NavItemConfig[] = [
  { href: '/dashboard/periods', icon: CalendarDays, key: 'periods', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/levels', icon: Layers, key: 'levels', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/classes', icon: BookOpen, key: 'classes', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/plans', icon: Wallet, key: 'plans', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/config', icon: Wrench, key: 'config', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/users', icon: Shield, key: 'users', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/schools', icon: Building2, key: 'schools', platformOnly: true },
  { href: '/dashboard/super-admins', icon: ShieldCheck, key: 'superAdmins', platformOnly: true },
]

const bottomItems: NavItemConfig[] = [
  { href: '/dashboard/settings', icon: Settings, key: 'settings' },
]

export type NavScope = {
  role: SchoolRole | null
  isSuperAdmin: boolean
  familyId?: string
}

export type VisibleNavItems = {
  gestion: NavItemConfig[]
  config: NavItemConfig[]
  bottom: NavItemConfig[]
}

export function resolveNavItems({ role, isSuperAdmin, familyId }: NavScope): VisibleNavItems {
  const canView = (item: NavItemConfig) => {
    // Contrôlé avant `requiredRoles` : un `ADMIN` d'école ne doit jamais hériter d'une
    // surface plateforme au motif qu'elle n'exige aucun rôle d'école.
    if (item.platformOnly) return isSuperAdmin
    if (!item.requiredRoles) return true
    if (isSuperAdmin) return true
    return role !== null && item.requiredRoles.includes(role)
  }

  if (role === 'PARENT') {
    return {
      gestion: [
        { href: '/dashboard', icon: LayoutGrid, key: 'dashboard' },
        {
          href: familyId ? `/dashboard/families/${familyId}` : '/dashboard/families',
          icon: Users,
          key: 'myFamily',
        },
      ],
      config: configItems.filter(canView),
      bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }],
    }
  }

  return { gestion: gestionItems, config: configItems.filter(canView), bottom: bottomItems }
}
