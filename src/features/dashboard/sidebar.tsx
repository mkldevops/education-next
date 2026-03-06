'use client'

import { Home, LogOut, Settings, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'

const navItems = [
  { href: '/dashboard', icon: Home, key: 'dashboard' },
  { href: '/profile', icon: User, key: 'profile' },
  { href: '/settings', icon: Settings, key: 'settings' },
] as const

export function Sidebar() {
  const t = useTranslations('dashboard.sidebar')
  const company = useTranslations('company')
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-gray-50">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="text-xl font-bold text-primary">
          {company('name')}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {t(item.key)}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <LogOut size={20} />
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}
