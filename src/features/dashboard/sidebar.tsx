'use client'

import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Settings,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'

const navItems = [
  { href: '/dashboard', icon: Home, key: 'dashboard' },
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/periods', icon: CalendarDays, key: 'periods' },
  { href: '/dashboard/levels', icon: Layers, key: 'levels' },
  { href: '/dashboard/classes', icon: BookOpen, key: 'classes' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments' },
  { href: '/dashboard/plans', icon: Wallet, key: 'plans' },
  { href: '/dashboard/config', icon: Wrench, key: 'config' },
] as const

const bottomItems = [{ href: '/settings', icon: Settings, key: 'settings' }] as const

export function Sidebar() {
  const t = useTranslations('dashboard.sidebar')
  const company = useTranslations('company')
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-gray-50">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="text-xl font-bold text-primary">
          {company('name')}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {t(item.key)}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {t(item.key)}
            </Link>
          )
        })}
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
