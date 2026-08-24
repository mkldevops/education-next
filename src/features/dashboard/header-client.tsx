'use client'

import { Menu, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/features/dashboard/period-selector'
import { SearchModal } from '@/features/dashboard/search-modal'
import { useSidebarStore } from '@/features/dashboard/sidebar-store'

interface DashboardHeaderClientProps {
  periods: { id: string; name: string; startAt: Date; endAt: Date }[]
  selectedPeriodId: string | null
}

export function DashboardHeaderClient({ periods, selectedPeriodId }: DashboardHeaderClientProps) {
  const t = useTranslations('dashboard.sidebar')
  const [searchOpen, setSearchOpen] = useState(false)
  const { toggleMobile } = useSidebarStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="flex h-16 items-center justify-between border-b border-alabaster-700 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMobile}
          aria-label={t('openMenu')}
          className="rounded p-2 text-graphite-700 transition-colors hover:bg-alabaster-900 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <PeriodSelector periods={periods} selectedPeriodId={selectedPeriodId} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden items-center sm:flex">
          <Search className="absolute left-3 h-4 w-4 text-graphite-700" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="w-64 cursor-pointer rounded border border-alabaster-700 bg-white py-2 pl-9 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            onClick={() => setSearchOpen(true)}
            readOnly
          />
          <kbd className="absolute right-3 rounded border border-alabaster-700 bg-alabaster-900 px-1.5 py-0.5 text-[10px] text-graphite-700">
            ⌘K
          </kbd>
        </div>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
