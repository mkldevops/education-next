'use client'

import { useTranslations } from 'next-intl'
import type { AuthorizedSchool } from '@/domain/school-scope'
import { usePathname, useRouter } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { SchoolRole } from '@/types/enums'
import { SchoolSwitcher } from './school-switcher'
import { resolveNavItems } from './sidebar-items'
import { NavItem } from './sidebar-nav-item'
import { useSidebarStore } from './sidebar-store'
import { UserMenu } from './sidebar-user-menu'

type SidebarProps = {
  role: SchoolRole | null
  isSuperAdmin: boolean
  familyId?: string
  logoUrl?: string
  schoolName?: string
  userName?: string
  schools?: AuthorizedSchool[]
  activeSchoolId?: string
  canSwitchSchool: boolean
}

export function Sidebar({
  role,
  isSuperAdmin,
  familyId,
  logoUrl,
  schoolName,
  userName,
  schools = [],
  activeSchoolId,
  canSwitchSchool,
}: SidebarProps) {
  const t = useTranslations('dashboard.sidebar')
  const platform = useTranslations('metadata')
  const pathname = usePathname()
  const router = useRouter()
  const { expanded, toggle, mobileOpen, setMobileOpen } = useSidebarStore()
  // Repli sur l'identité plateforme, jamais sur `company` : ce namespace décrit
  // l'exploitant de la plateforme, pas une école affichée.
  const displayName = schoolName || platform('platformTitle')
  const items = resolveNavItems({ role, isSuperAdmin, familyId })

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
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

  const renderItems = (configs: typeof items.gestion) =>
    configs.map((item) => (
      <NavItem
        key={item.key}
        href={item.href}
        icon={item.icon}
        label={t(item.key)}
        active={isActive(item.href)}
        expanded={expanded}
        onClick={handleNavClick}
      />
    ))

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
        <SchoolSwitcher
          schools={schools}
          activeSchoolId={activeSchoolId}
          canSwitchSchool={canSwitchSchool}
          displayName={displayName}
          logoUrl={logoUrl}
          expanded={expanded}
        />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {expanded && (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t('sectionGestion')}
            </p>
          )}
          <div className="space-y-1">{renderItems(items.gestion)}</div>

          {items.config.length > 0 && (
            <>
              {expanded ? (
                <p className="mb-2 mt-6 border-t border-alabaster-700 px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('sectionConfig')}
                </p>
              ) : (
                <div className="my-4 border-t border-alabaster-700" />
              )}
              <div className="space-y-1">{renderItems(items.config)}</div>
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-alabaster-700 p-3">
          <UserMenu
            userName={userName}
            items={items.bottom}
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
