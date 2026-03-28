'use client'

import { Bell, Menu, Search } from 'lucide-react'
import { useState } from 'react'
import { PeriodSelector } from '@/features/dashboard/period-selector'
import { SearchModal } from '@/features/dashboard/search-modal'
import { useSidebarStore } from '@/features/dashboard/sidebar-store'
import { useSession } from '@/lib/auth-client'

interface DashboardHeaderClientProps {
  periods: { id: string; name: string }[]
  selectedPeriodId: string | null
}

export function DashboardHeaderClient({ periods, selectedPeriodId }: DashboardHeaderClientProps) {
  const { data: session } = useSession()
  const [searchOpen, setSearchOpen] = useState(false)
  const { toggleMobile } = useSidebarStore()

  return (
    <header className="flex h-16 items-center justify-between border-b border-alabaster-700 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMobile}
          aria-label="Ouvrir le menu"
          className="rounded-xl p-2 text-graphite-700 transition-colors hover:bg-alabaster-900 md:hidden"
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
            placeholder="Rechercher..."
            className="w-64 cursor-pointer rounded-xl border border-alabaster-700 bg-white py-2 pl-9 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            onClick={() => setSearchOpen(true)}
            readOnly
          />
          <kbd className="absolute right-3 rounded border border-alabaster-700 bg-alabaster-900 px-1.5 py-0.5 text-[10px] text-graphite-700">
            ⌘K
          </kbd>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-xl p-2 transition-colors hover:bg-alabaster-900"
        >
          <Bell className="h-5 w-5 text-graphite-600" />
        </button>

        {session?.user && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stormy-teal to-yale-blue text-xs font-semibold text-white">
            {session.user.name?.charAt(0).toUpperCase() ||
              session.user.email?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
