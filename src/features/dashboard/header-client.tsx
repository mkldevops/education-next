'use client'

import { Menu, PanelLeft, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/features/dashboard/period-selector'
import { SearchModal } from '@/features/dashboard/search-modal'
import { useSidebarStore } from '@/features/dashboard/sidebar-store'
import { useSearchShortcutLabel } from './shortcut'

interface DashboardHeaderClientProps {
  periods: { id: string; name: string; startAt: Date; endAt: Date }[]
  selectedPeriodId: string | null
}

const iconButton =
  'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'

export function DashboardHeaderClient({ periods, selectedPeriodId }: DashboardHeaderClientProps) {
  const t = useTranslations('dashboard.sidebar')
  const [searchOpen, setSearchOpen] = useState(false)
  const toggleMobile = useSidebarStore((state) => state.toggleMobile)
  const toggle = useSidebarStore((state) => state.toggle)
  const shortcut = useSearchShortcutLabel()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={toggleMobile}
          aria-label={t('openMenu')}
          className={`${iconButton} md:hidden`}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={t('toggleSidebar')}
          className={`${iconButton} hidden md:flex`}
        >
          <PanelLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border md:block" />
        <PeriodSelector periods={periods} selectedPeriodId={selectedPeriodId} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t('searchPlaceholder')}
          aria-keyshortcuts="Meta+K Control+K"
          className="group hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground shadow-xs transition-colors duration-(--duration-fast) hover:border-input/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:flex lg:w-72"
        >
          <Search size={16} aria-hidden="true" className="shrink-0" />
          <span className="flex-1 truncate text-left">{t('searchPlaceholder')}</span>
          <kbd className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
            {shortcut}
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t('searchPlaceholder')}
          className={`${iconButton} sm:hidden`}
        >
          <Search size={20} aria-hidden="true" />
        </button>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
