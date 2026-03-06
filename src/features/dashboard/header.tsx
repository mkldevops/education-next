'use client'

import { LanguageSwitcher } from '@/features/navbar/language-switcher'
import { useSession } from '@/lib/auth-client'

export function DashboardHeader() {
  const { data: session } = useSession()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>{/* Breadcrumb or page title can go here */}</div>

      <div className="flex items-center gap-4">
        <LanguageSwitcher />

        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {session.user.name?.charAt(0).toUpperCase() ||
                  session.user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {session.user.name || session.user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
