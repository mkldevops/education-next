import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutGrid,
  Settings,
  Shield,
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
