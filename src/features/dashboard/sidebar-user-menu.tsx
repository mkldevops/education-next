'use client'

import { useMenu } from '@peaklab/ui'
import { ChevronsLeft, ChevronsRight, ChevronsUpDown, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { toInitials } from './initials'
import type { NavItemConfig } from './sidebar-items'

const itemClass =
  'flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-graphite-600 transition-colors hover:bg-alabaster-900 hover:text-graphite'

export function UserMenu({
  userName,
  items,
  expanded,
  onNavigate,
  onSignOut,
  onToggle,
}: {
  userName?: string
  items: NavItemConfig[]
  expanded: boolean
  onNavigate: () => void
  onSignOut: () => void
  onToggle: () => void
}) {
  const t = useTranslations('dashboard.sidebar')
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const label = userName ?? t('account')

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={expanded ? undefined : label}
        className={cn(
          'flex w-full items-center rounded transition-colors hover:bg-alabaster-900',
          expanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'
        )}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white"
        >
          {toInitials(label)}
        </span>
        {expanded && (
          <>
            <span className="flex-1 truncate text-sm font-medium text-graphite-600">{label}</span>
            <ChevronsUpDown size={16} className="shrink-0 text-graphite-800" />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            'absolute z-40 rounded border border-alabaster-700 bg-white p-1 shadow-lg',
            expanded ? 'bottom-full left-0 right-0 mb-2' : 'bottom-0 left-full ml-2 w-56'
          )}
        >
          {items.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close(false)
                onNavigate()
              }}
            >
              <Icon size={18} className="shrink-0" />
              {t(key)}
            </Link>
          ))}

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close(false)
              onSignOut()
            }}
          >
            <LogOut size={18} className="shrink-0" />
            {t('logout')}
          </button>

          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, 'hidden md:flex')}
            onClick={() => {
              close(false)
              onToggle()
            }}
          >
            {expanded ? (
              <ChevronsLeft size={18} className="shrink-0" />
            ) : (
              <ChevronsRight size={18} className="shrink-0" />
            )}
            {expanded ? t('collapse') : t('expand')}
          </button>
        </div>
      )}
    </div>
  )
}
