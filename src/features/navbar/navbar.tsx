'use client'

import { Button } from '@peaklab/ui'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import { signOut, useSession } from '@/lib/auth-client'
import { LanguageSwitcher } from './language-switcher'

const navItems = [{ href: '/', key: 'home' }] as const

export function Navbar() {
  const t = useTranslations('navbar')
  const company = useTranslations('company')
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled ? 'bg-white/95 shadow-sm backdrop-blur-sm' : 'bg-white'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">{company('name')}</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.href ? 'text-primary' : 'text-gray-700'
              }`}
            >
              {t(item.key)}
            </Link>
          ))}

          <LanguageSwitcher />

          {session ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  {t('dashboard')}
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={handleSignOut}>
                {t('logout')}
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">{t('login')}</Button>
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-t bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`text-sm font-medium ${
                  pathname === item.href ? 'text-primary' : 'text-gray-700'
                }`}
              >
                {t(item.key)}
              </Link>
            ))}
            <LanguageSwitcher />
            {session ? (
              <>
                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">
                    {t('dashboard')}
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full" onClick={handleSignOut}>
                  {t('logout')}
                </Button>
              </>
            ) : (
              <Link href="/login" onClick={() => setIsOpen(false)}>
                <Button className="w-full">{t('login')}</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
