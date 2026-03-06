'use client'

import { Bell, Search } from 'lucide-react'
import { LanguageSwitcher } from '@/features/navbar/language-switcher'
import { useSession } from '@/lib/auth-client'

export function DashboardHeader() {
  const { data: session } = useSession()

  return (
    <header className="flex items-center justify-end gap-4 px-6 py-3">
      <div className="relative hidden sm:flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-graphite-700" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="w-64 pl-9 pr-12 py-2 text-sm border border-white/80 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white"
        />
        <kbd className="absolute right-3 rounded border border-alabaster-700 bg-white px-1.5 py-0.5 text-[10px] text-graphite-700">
          ⌘K
        </kbd>
      </div>

      <LanguageSwitcher />

      <button type="button" className="p-2 hover:bg-white/50 rounded-xl transition-colors">
        <Bell className="h-5 w-5 text-graphite-600" />
      </button>

      {session?.user && (
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-stormy-teal to-yale-blue flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
          {session.user.name?.charAt(0).toUpperCase() ||
            session.user.email?.charAt(0).toUpperCase()}
        </div>
      )}
    </header>
  )
}
