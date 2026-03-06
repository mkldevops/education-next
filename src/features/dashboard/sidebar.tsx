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

const gestionItems = [
  { href: '/dashboard', icon: Home, key: 'dashboard' },
  { href: '/dashboard/families', icon: Users, key: 'families' },
  { href: '/dashboard/students', icon: GraduationCap, key: 'students' },
  { href: '/dashboard/enrollments', icon: ClipboardList, key: 'enrollments' },
  { href: '/dashboard/payments', icon: CreditCard, key: 'payments' },
] as const

const configItems = [
  { href: '/dashboard/periods', icon: CalendarDays, key: 'periods' },
  { href: '/dashboard/levels', icon: Layers, key: 'levels' },
  { href: '/dashboard/classes', icon: BookOpen, key: 'classes' },
  { href: '/dashboard/plans', icon: Wallet, key: 'plans' },
  { href: '/dashboard/config', icon: Wrench, key: 'config' },
] as const

const bottomItems = [{ href: '/dashboard/settings', icon: Settings, key: 'settings' }] as const

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

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 mb-2 text-xs font-semibold uppercase text-gray-400 tracking-wider">
          {t('sectionGestion')}
        </p>
        <div className="space-y-1">
          {gestionItems.map((item) => {
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
        </div>

        <p className="px-3 mt-6 mb-2 text-xs font-semibold uppercase text-gray-400 tracking-wider border-t pt-4">
          {t('sectionConfig')}
        </p>
        <div className="space-y-1">
          {configItems.map((item) => {
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
        </div>
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
