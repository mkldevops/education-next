'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Layers,
  LayoutGrid,
  LogOut,
  Settings,
  Shield,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import type { SchoolRole } from '@/types/enums'
import { toInitials } from './initials'
import { useSidebarStore } from './sidebar-store'

type NavItemConfig = {
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
  {
    href: '/dashboard/periods',
    icon: CalendarDays,
    key: 'periods',
    requiredRoles: ['ADMIN'],
  },
  {
    href: '/dashboard/levels',
    icon: Layers,
    key: 'levels',
    requiredRoles: ['ADMIN'],
  },
  {
    href: '/dashboard/classes',
    icon: BookOpen,
    key: 'classes',
    requiredRoles: ['ADMIN'],
  },
  { href: '/dashboard/plans', icon: Wallet, key: 'plans', requiredRoles: ['ADMIN'] },
  {
    href: '/dashboard/config',
    icon: Wrench,
    key: 'config',
    requiredRoles: ['ADMIN'],
  },
  {
    href: '/dashboard/users',
    icon: Shield,
    key: 'users',
    requiredRoles: ['ADMIN'],
  },
]

const bottomItems: NavItemConfig[] = [
  { href: '/dashboard/settings', icon: Settings, key: 'settings' },
]

function Tooltip({
  label,
  children,
}: {
  label: string
  children: (describedBy: string | undefined) => React.ReactNode
}) {
  const tooltipId = useId()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = (e: React.MouseEvent | React.FocusEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  const hide = () => setPos(null)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tooltip wrapper
    <div onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children(pos ? tooltipId : undefined)}
      {pos &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="fixed z-50 -translate-y-1/2 rounded bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
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
  onClick,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  expanded: boolean
  onClick?: () => void
}) {
  const link = (describedBy?: string) => (
    <Link
      href={href}
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-describedby={describedBy}
      className={cn(
        'flex items-center rounded transition-all duration-150',
        expanded ? 'gap-3 px-3 py-2' : 'size-11 justify-center',
        active
          ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/25'
          : 'text-graphite-800 hover:bg-alabaster-900 hover:text-graphite-600'
      )}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )

  if (!expanded) return <Tooltip label={label}>{link}</Tooltip>
  return link()
}

function UserMenu({
  userName,
  items,
  expanded,
  onNavigate,
  onSignOut,
  onToggle,
}: {
  userName?: string
  items: NavItemConfig[]
  expanded: boolean
  onNavigate: () => void
  onSignOut: () => void
  onToggle: () => void
}) {
  const t = useTranslations('dashboard.sidebar')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const label = userName ?? t('account')

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

      e.preventDefault()
      const focusable = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
      )
      if (focusable.length === 0) return

      const current = focusable.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown'
          ? current < focusable.length - 1
            ? current + 1
            : 0
          : current > 0
            ? current - 1
            : focusable.length - 1
      focusable[next].focus()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  const itemClass =
    'flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-graphite-800 transition-colors hover:bg-alabaster-900 hover:text-graphite-600'

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={expanded ? undefined : label}
        className={cn(
          'flex w-full items-center rounded transition-colors hover:bg-alabaster-900',
          expanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'
        )}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white"
        >
          {toInitials(label)}
        </span>
        {expanded && (
          <>
            <span className="flex-1 truncate text-sm font-medium text-graphite-600">{label}</span>
            <ChevronsUpDown size={16} className="shrink-0 text-graphite-800" />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            'absolute z-40 rounded border border-alabaster-700 bg-white p-1 shadow-lg',
            expanded ? 'bottom-full left-0 right-0 mb-2' : 'bottom-0 left-full ml-2 w-56'
          )}
        >
          {items.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close(false)
                onNavigate()
              }}
            >
              <Icon size={18} className="shrink-0" />
              {t(key)}
            </Link>
          ))}

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close(false)
              onSignOut()
            }}
          >
            <LogOut size={18} className="shrink-0" />
            {t('logout')}
          </button>

          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, 'hidden md:flex')}
            onClick={() => {
              close(false)
              onToggle()
            }}
          >
            {expanded ? (
              <ChevronsLeft size={18} className="shrink-0" />
            ) : (
              <ChevronsRight size={18} className="shrink-0" />
            )}
            {expanded ? t('collapse') : t('expand')}
          </button>
        </div>
      )}
    </div>
  )
}

type SidebarProps = {
  role: SchoolRole | null
  isSuperAdmin: boolean
  familyId?: string
  logoUrl?: string
  schoolName?: string
  userName?: string
}

export function Sidebar({
  role,
  isSuperAdmin,
  familyId,
  logoUrl,
  schoolName,
  userName,
}: SidebarProps) {
  const t = useTranslations('dashboard.sidebar')
  const company = useTranslations('company')
  const pathname = usePathname()
  const router = useRouter()
  const { expanded, toggle, mobileOpen, setMobileOpen } = useSidebarStore()
  const displayName = schoolName || company('name')

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const canViewItem = (item: NavItemConfig) => {
    if (!item.requiredRoles) return true
    if (isSuperAdmin) return true
    return role !== null && item.requiredRoles.includes(role)
  }

  const visibleConfigItems = configItems.filter(canViewItem)
  const visibleGestionItems =
    role === 'PARENT'
      ? [
          { href: '/dashboard', icon: LayoutGrid, key: 'dashboard' },
          {
            href: familyId ? `/dashboard/families/${familyId}` : '/dashboard/families',
            icon: Users,
            key: 'myFamily',
          },
        ]
      : gestionItems
  const visibleBottomItems =
    role === 'PARENT'
      ? [{ href: '/dashboard/settings', icon: Settings, key: 'profile' }]
      : bottomItems

  const handleNavClick = () => setMobileOpen(false)

  const handleSignOut = async () => {
    await signOut()
    setMobileOpen(false)
    router.replace('/')
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label={t('closeMenu')}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-alabaster-700 bg-white transition-all duration-200',
          'md:sticky md:top-0 md:z-30',
          expanded ? 'w-64' : 'w-64 md:w-[72px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center py-4',
            expanded ? 'h-16 border-b border-alabaster-700 px-6' : 'justify-center'
          )}
        >
          {expanded ? (
            <Link href="/" className="flex items-center gap-2">
              {logoUrl ? (
                // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
                <img src={logoUrl} alt={displayName} className="h-8 w-auto object-contain" />
              ) : (
                <span className="text-xl font-bold text-primary">{displayName}</span>
              )}
            </Link>
          ) : (
            <Link
              href="/"
              className="flex size-10 items-center justify-center rounded bg-gradient-to-br from-primary to-primary/70 text-[15px] font-extrabold text-white"
            >
              {logoUrl ? (
                // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
                <img src={logoUrl} alt={displayName} className="size-8 rounded object-contain" />
              ) : (
                toInitials(displayName)
              )}
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
            {visibleGestionItems.map((item) => (
              <NavItem
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(item.key)}
                active={isActive(item.href)}
                expanded={expanded}
                onClick={handleNavClick}
              />
            ))}
          </div>

          {visibleConfigItems.length > 0 && (
            <>
              {expanded ? (
                <p className="mb-2 mt-6 border-t border-alabaster-700 px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-alabaster-700 p-3">
          <UserMenu
            userName={userName}
            items={visibleBottomItems}
            expanded={expanded}
            onNavigate={handleNavClick}
            onSignOut={handleSignOut}
            onToggle={toggle}
          />
        </div>
      </aside>
    </>
  )
}
