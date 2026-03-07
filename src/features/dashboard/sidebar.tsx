'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutGrid,
  Settings,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/enums'
import { useSidebarStore } from './sidebar-store'

type NavItemConfig = {
  href: string
  icon: LucideIcon
  key: string
  requiredRoles?: Role[]
}

const gestionItems: NavItemConfig[] = [
  { href: '/dashboard', icon: LayoutGrid, key: 'dashboard' },
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments' },
]

const configItems: NavItemConfig[] = [
  {
    href: '/dashboard/periods',
    icon: CalendarDays,
    key: 'periods',
    requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/dashboard/levels',
    icon: Layers,
    key: 'levels',
    requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    href: '/dashboard/classes',
    icon: BookOpen,
    key: 'classes',
    requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
  { href: '/dashboard/plans', icon: Wallet, key: 'plans', requiredRoles: ['ADMIN', 'SUPER_ADMIN'] },
  {
    href: '/dashboard/config',
    icon: Wrench,
    key: 'config',
    requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
]

const bottomItems: NavItemConfig[] = [
  { href: '/dashboard/settings', icon: Settings, key: 'settings' },
]

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  const handleMouseLeave = () => setPos(null)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tooltip wrapper
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {pos &&
        createPortal(
          <div
            className="fixed z-50 -translate-y-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
          </div>,
          document.body
        )}
    </div>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  expanded,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  expanded: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center rounded-xl transition-all duration-150',
        expanded ? 'gap-3 px-3 py-2' : 'size-11 justify-center',
        active
          ? 'bg-gradient-to-br from-stormy-teal to-yale-blue text-white shadow-[0_4px_12px_rgba(60,110,113,0.3)]'
          : 'text-graphite-800 hover:bg-alabaster-900 hover:text-graphite-600'
      )}
    >
      <Icon size={20} className="flex-shrink-0" />
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )

  if (!expanded) return <Tooltip label={label}>{link}</Tooltip>
  return link
}

type SidebarProps = {
  role: Role
}

export function Sidebar({ role }: SidebarProps) {
  const t = useTranslations('dashboard.sidebar')
  const company = useTranslations('company')
  const pathname = usePathname()
  const { expanded, toggle } = useSidebarStore()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const canViewItem = (item: NavItemConfig) => {
    if (!item.requiredRoles) return true
    return item.requiredRoles.includes(role)
  }

  const visibleConfigItems = configItems.filter(canViewItem)

  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen flex-col border-r border-alabaster-700 bg-white transition-all duration-200',
        expanded ? 'w-64' : 'w-[72px]'
      )}
    >
      <div
        className={cn(
          'flex items-center flex-shrink-0 py-4',
          expanded ? 'h-16 border-b border-alabaster-700 px-6' : 'justify-center'
        )}
      >
        {expanded ? (
          <Link href="/" className="text-xl font-bold text-primary">
            {company('name')}
          </Link>
        ) : (
          <Link
            href="/"
            className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-stormy-teal to-yale-blue text-[15px] font-extrabold text-white"
          >
            AN
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {expanded && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {t('sectionGestion')}
          </p>
        )}
        <div className="space-y-1">
          {gestionItems.map((item) => (
            <NavItem
              key={item.key}
              href={item.href}
              icon={item.icon}
              label={t(item.key)}
              active={isActive(item.href)}
              expanded={expanded}
            />
          ))}
        </div>

        {visibleConfigItems.length > 0 && (
          <>
            {expanded ? (
              <p className="mb-2 mt-6 border-t border-alabaster-700 pt-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('sectionConfig')}
              </p>
            ) : (
              <div className="my-4 border-t border-alabaster-700" />
            )}
            <div className="space-y-1">
              {visibleConfigItems.map((item) => (
                <NavItem
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.key)}
                  active={isActive(item.href)}
                  expanded={expanded}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-alabaster-700 p-3 flex-shrink-0">
        {bottomItems.map((item) => (
          <NavItem
            key={item.key}
            href={item.href}
            icon={item.icon}
            label={t(item.key)}
            active={isActive(item.href)}
            expanded={expanded}
          />
        ))}

        <button
          type="button"
          onClick={toggle}
          className={cn(
            'mt-2 flex w-full items-center rounded-xl py-2 text-graphite-800 transition-all duration-150 hover:bg-alabaster-900 hover:text-graphite-600',
            expanded ? 'gap-3 px-3' : 'justify-center px-2'
          )}
        >
          {expanded ? (
            <>
              <ChevronsLeft size={18} className="flex-shrink-0" />
              <span className="text-xs font-medium">{t('collapse')}</span>
            </>
          ) : (
            <ChevronsRight size={18} />
          )}
        </button>
      </div>
    </aside>
  )
}
