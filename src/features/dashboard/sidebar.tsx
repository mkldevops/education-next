'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import type { AuthorizedSchool } from '@/domain/school-scope'
import { usePathname, useRouter } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { SchoolRole } from '@/types/enums'
import { SchoolSwitcher } from './school-switcher'
import { type NavItemConfig, type NavScope, resolveNavItems } from './sidebar-items'
import { NavItem } from './sidebar-nav-item'
import { useSidebarStore } from './sidebar-store'
import { UserMenu } from './sidebar-user-menu'

type SidebarProps = {
  roles: readonly SchoolRole[]
  isSuperAdmin: boolean
  paymentsEnabled: boolean
  familyId?: string
  hasTeacherCapability?: boolean
  hasStaffAccess?: boolean
  logoUrl?: string
  schoolName?: string
  userName?: string
  schools?: AuthorizedSchool[]
  activeSchoolId?: string
  canSwitchSchool: boolean
  classScheduleEnabled?: boolean
  eventsEnabled?: boolean
  attendanceEnabled?: boolean
  aiAssistantEnabled?: boolean
  mealsEnabled?: boolean
}

export function Sidebar({
  roles,
  isSuperAdmin,
  paymentsEnabled,
  familyId,
  hasTeacherCapability = false,
  hasStaffAccess = false,
  logoUrl,
  schoolName,
  userName,
  schools = [],
  activeSchoolId,
  canSwitchSchool,
  classScheduleEnabled = false,
  eventsEnabled = false,
  attendanceEnabled = false,
  aiAssistantEnabled = false,
  mealsEnabled = false,
}: SidebarProps) {
  const t = useTranslations('dashboard.sidebar')
  const platform = useTranslations('metadata')
  const pathname = usePathname()
  const router = useRouter()
  const { expanded, toggle, mobileOpen, setMobileOpen, setNavScope } = useSidebarStore()
  // Le tiroir mobile affiche toujours les libellés : l'état replié ne concerne que le bureau.
  const showLabels = expanded || mobileOpen
  // Repli sur l'identité plateforme, jamais sur `company` : ce namespace décrit
  // l'exploitant de la plateforme, pas une école affichée.
  const displayName = schoolName || platform('platformTitle')
  const navScope: NavScope = {
    roles,
    isSuperAdmin,
    familyId,
    hasTeacherCapability,
    hasStaffAccess,
    features: {
      classSchedule: classScheduleEnabled,
      events: eventsEnabled,
      payments: paymentsEnabled,
      attendance: attendanceEnabled,
      aiAssistant: aiAssistantEnabled,
      meals: mealsEnabled,
    },
  }
  const items = resolveNavItems(navScope)
  const scopeKey = JSON.stringify(navScope)

  useEffect(() => {
    setNavScope(JSON.parse(scopeKey) as NavScope)
  }, [scopeKey, setNavScope])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, setMobileOpen])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleNavClick = () => setMobileOpen(false)

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error(t('logoutError'))
      return
    }
    setMobileOpen(false)
    router.replace('/')
  }

  const renderItems = (configs: NavItemConfig[]) =>
    configs.map((item) => (
      <li key={item.key}>
        <NavItem
          href={item.href}
          icon={item.icon}
          label={t(item.key)}
          active={isActive(item.href)}
          expanded={showLabels}
          onClick={handleNavClick}
        />
      </li>
    ))

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-(--duration-base) md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        aria-label={t('navigation')}
        className={cn(
          'fixed top-(--safe-area-top) bottom-(--safe-area-bottom) left-(--safe-area-left) z-50 flex flex-col border-r border-border bg-surface',
          'transition-[width,translate] duration-(--duration-base) ease-out',
          'md:sticky md:top-0 md:z-30 md:bg-background',
          expanded ? 'w-72 md:w-60' : 'w-72 md:w-[68px]',
          mobileOpen
            ? 'translate-x-0 shadow-lg md:shadow-none'
            : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-1 px-3">
          <div className="min-w-0 flex-1">
            <SchoolSwitcher
              schools={schools}
              activeSchoolId={activeSchoolId}
              canSwitchSchool={canSwitchSchool}
              displayName={displayName}
              logoUrl={logoUrl}
              expanded={showLabels}
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t('closeMenu')}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring md:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {items.sections.map((section, index) => (
            <div key={section.key} className={cn(index > 0 && (showLabels ? 'mt-5' : 'mt-3'))}>
              {showLabels ? (
                <p
                  aria-hidden="true"
                  className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {t(`sections.${section.key}`)}
                </p>
              ) : (
                index > 0 && <div aria-hidden="true" className="mx-auto mb-3 h-px w-6 bg-border" />
              )}
              <ul aria-label={t(`sections.${section.key}`)} className="space-y-0.5">
                {renderItems(section.items)}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <UserMenu
            userName={userName}
            items={items.bottom}
            expanded={showLabels}
            onNavigate={handleNavClick}
            onSignOut={handleSignOut}
            onToggle={toggle}
          />
        </div>
      </aside>
    </>
  )
}
