import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  House,
  Layers,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react'
import type { SchoolRole } from '@/types/enums'

export type NavItemConfig = {
  href: string
  icon: LucideIcon
  key: string
  requiredRoles?: SchoolRole[]
  /** Surface plateforme : réservée à `isSuperAdmin`, qu'aucun rôle d'école ne couvre. */
  platformOnly?: true
  /**
   * Surface pilotée par un réglage ; `canView` la ferme quand il est éteint. `aiAssistant`
   * est un réglage plateforme, les autres des réglages d'école.
   */
  feature?: 'classSchedule' | 'events' | 'payments' | 'attendance' | 'aiAssistant'
}

/** Clé de traduction du libellé de groupe, sous `dashboard.sidebar.sections`. */
export type NavSectionKey =
  | 'today'
  | 'schooling'
  | 'finance'
  | 'settings'
  | 'platform'
  | 'family'
  | 'teaching'

type NavSection = {
  key: NavSectionKey
  items: NavItemConfig[]
}

const MY_CLASSES: NavItemConfig = {
  href: '/dashboard/my-classes',
  icon: BookMarked,
  key: 'myClasses',
}

const MY_FAMILIES: NavItemConfig = {
  href: '/dashboard/my-families',
  icon: Users,
  key: 'myFamilies',
}

const todayItems: NavItemConfig[] = [
  { href: '/dashboard', icon: House, key: 'dashboard' },
  { href: '/dashboard/attendance', icon: ClipboardCheck, key: 'attendance', feature: 'attendance' },
  { href: '/dashboard/planning', icon: CalendarRange, key: 'planning', feature: 'classSchedule' },
  {
    href: '/dashboard/events',
    icon: CalendarHeart,
    key: 'events',
    requiredRoles: ['ADMIN'],
    feature: 'events',
  },
]

const schoolingItems: NavItemConfig[] = [
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  {
    href: '/dashboard/enroll-assistant',
    icon: Sparkles,
    key: 'enrollAssistant',
    requiredRoles: ['ADMIN'],
    feature: 'aiAssistant',
  },
  { href: '/dashboard/classes', icon: BookOpen, key: 'classes', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/teachers', icon: UserRoundCheck, key: 'teachers', requiredRoles: ['ADMIN'] },
]

const financeItems: NavItemConfig[] = [
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments', feature: 'payments' },
  {
    href: '/dashboard/plans',
    icon: Wallet,
    key: 'plans',
    requiredRoles: ['ADMIN'],
    feature: 'payments',
  },
]

const settingsItems: NavItemConfig[] = [
  { href: '/dashboard/periods', icon: CalendarDays, key: 'periods', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/levels', icon: Layers, key: 'levels', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/config', icon: SlidersHorizontal, key: 'config', requiredRoles: ['ADMIN'] },
  { href: '/dashboard/users', icon: UserCog, key: 'users', requiredRoles: ['ADMIN'] },
]

const platformItems: NavItemConfig[] = [
  { href: '/dashboard/schools', icon: Building2, key: 'schools', platformOnly: true },
  { href: '/dashboard/super-admins', icon: ShieldCheck, key: 'superAdmins', platformOnly: true },
]

export type NavScope = {
  role: SchoolRole | null
  isSuperAdmin: boolean
  familyId?: string
  hasTeacherCapability?: boolean
  features: {
    classSchedule?: boolean
    events: boolean
    payments: boolean
    attendance?: boolean
    aiAssistant?: boolean
  }
}

export type VisibleNavItems = {
  sections: NavSection[]
  bottom: NavItemConfig[]
}

const section = (key: NavSectionKey, items: NavItemConfig[]): NavSection[] =>
  items.length > 0 ? [{ key, items }] : []

/** Toutes les entrées visibles, groupes aplatis, dans l'ordre d'affichage. */
export function flattenNavItems({ sections }: VisibleNavItems): NavItemConfig[] {
  return sections.flatMap((group) => group.items)
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

  // Réglages et plateforme restent filtrés par `canView` quel que soit le rôle d'école :
  // un super-admin rattaché comme parent garde ses surfaces d'administration.
  const administration = [
    ...section('settings', settingsItems.filter(canView)),
    ...section('platform', platformItems.filter(canView)),
  ]

  if (role === 'PARENT') {
    return {
      sections: [
        ...section('family', [
          { href: '/dashboard', icon: House, key: 'dashboard' },
          {
            href: familyId ? `/dashboard/families/${familyId}` : '/dashboard/families',
            icon: Users,
            key: 'myFamily',
          },
          ...(features.classSchedule
            ? [{ href: '/dashboard/planning', icon: CalendarRange, key: 'planning' }]
            : []),
          ...(hasTeacherCapability ? [MY_CLASSES, MY_FAMILIES] : []),
        ]),
        ...administration,
      ],
      bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }],
    }
  }

  if (role === 'TEACHER') {
    return {
      sections: section('teaching', [
        MY_CLASSES,
        ...(features.classSchedule
          ? [{ href: '/dashboard/planning', icon: CalendarRange, key: 'planning' }]
          : []),
        ...(features.attendance
          ? [{ href: '/dashboard/attendance', icon: ClipboardCheck, key: 'attendance' }]
          : []),
        MY_FAMILIES,
      ]),
      bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }],
    }
  }

  return {
    sections: [
      ...section('today', todayItems.filter(canView)),
      ...section('schooling', [
        ...schoolingItems.filter(canView),
        ...(hasTeacherCapability ? [MY_CLASSES] : []),
      ]),
      ...section('finance', financeItems.filter(canView)),
      ...administration,
    ],
    bottom: [{ href: '/dashboard/settings', icon: Settings, key: 'settings' }],
  }
}
