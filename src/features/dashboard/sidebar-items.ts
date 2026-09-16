import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutGrid,
  Settings,
  Shield,
  ShieldCheck,
  UserRoundCheck,
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
  /** Surface pilotée par un réglage d'école ; `canView` la ferme quand il est éteint. */
  feature?: 'classSchedule' | 'events' | 'payments' | 'attendance'
}

const gestionItems: NavItemConfig[] = [
  { href: '/dashboard', icon: LayoutGrid, key: 'dashboard' },
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments', feature: 'payments' },
  { href: '/dashboard/attendance', icon: ClipboardList, key: 'attendance', feature: 'attendance' },
  {
    href: '/dashboard/events',
    icon: CalendarHeart,
    key: 'events',
    requiredRoles: ['ADMIN'],
    feature: 'events',
  },
  {
    href: '/dashboard/planning',
    icon: CalendarDays,
    key: 'planning',
    feature: 'classSchedule',
  },
]

const configItems: NavItemConfig[] = [
  { href: '/dashboard/periods', icon: CalendarDays, key: 'periods', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/levels', icon: Layers, key: 'levels', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/classes', icon: BookOpen, key: 'classes', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/teachers', icon: UserRoundCheck, key: 'teachers', requiredRoles: ['ADMIN'] },
  {
    href: '/dashboard/plans',
    icon: Wallet,
    key: 'plans',
    requiredRoles: ['ADMIN'],
    feature: 'payments',
  },
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
  hasTeacherCapability?: boolean
  features: { classSchedule?: boolean; events: boolean; payments: boolean; attendance?: boolean }
}

export type VisibleNavItems = {
  gestion: NavItemConfig[]
  config: NavItemConfig[]
  bottom: NavItemConfig[]
}

export function resolveNavItems({
  role,
  isSuperAdmin,
  familyId,
  hasTeacherCapability = false,
  features,
}: NavScope): VisibleNavItems {
  const canView = (item: NavItemConfig) => {
    // Contrôlé avant tout le reste : un drapeau d'école éteint ferme la surface même à
    // un super-admin, exactement comme la tête de la barre latérale suit la marque seule.
    if (item.feature && !features[item.feature]) return false
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
        ...(features.classSchedule
          ? [{ href: '/dashboard/planning', icon: CalendarDays, key: 'planning' }]
          : []),
        ...(hasTeacherCapability
          ? [{ href: '/dashboard/my-classes', icon: BookOpen, key: 'myClasses' }]
          : []),
      ],
      config: configItems.filter(canView),
      bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }],
    }
  }

  if (role === 'TEACHER') {
    return {
      gestion: [
        { href: '/dashboard/my-classes', icon: BookOpen, key: 'myClasses' },
        ...(features.attendance
          ? [{ href: '/dashboard/attendance', icon: ClipboardList, key: 'attendance' }]
          : []),
      ],
      config: [],
      bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }],
    }
  }

  return {
    gestion: [
      ...gestionItems.filter(canView),
      ...(hasTeacherCapability
        ? [{ href: '/dashboard/my-classes', icon: BookOpen, key: 'myClasses' }]
        : []),
    ],
    config: configItems.filter(canView),
    bottom: bottomItems,
  }
}
