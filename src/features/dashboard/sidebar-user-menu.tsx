'use client'

import { Dialog, useDialog, useMenu } from '@peaklab/ui'
import {
  ChevronsUpDown,
  Download,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { IosInstallGuide, useInstallApp } from '@/features/pwa/install-app'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { toInitials } from './initials'
import type { NavItemConfig } from './sidebar-items'

const itemClass =
  'flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none'

type UserMenuProps = {
  userName?: string
  items: NavItemConfig[]
  /** Nouveautés non lues ; `null` quand le fil n'est pas proposé à cet utilisateur. */
  unreadNews?: number | null
  expanded: boolean
  onNavigate: () => void
  onSignOut: () => void
  onToggle: () => void
}

export function UserMenu(props: UserMenuProps) {
  const { mode } = useInstallApp()
  return (
    <Dialog>
      <UserMenuDropdown {...props} />
      {mode === 'ios' && <IosInstallGuide />}
    </Dialog>
  )
}

function UserMenuDropdown({
  userName,
  items,
  unreadNews = null,
  expanded,
  onNavigate,
  onSignOut,
  onToggle,
}: UserMenuProps) {
  const t = useTranslations('dashboard.sidebar')
  const tNews = useTranslations('dashboard.announcements')
  const tInstall = useTranslations('pwa.install')
  const { mode: installMode, install } = useInstallApp()
  const { setOpen: openInstallGuide } = useDialog()
  const hasUnread = unreadNews !== null && unreadNews > 0
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
        aria-label={
          hasUnread
            ? `${label} – ${tNews('buttonLabelUnread', { count: unreadNews })}`
            : expanded
              ? undefined
              : label
        }
        className={cn(
          'flex w-full items-center rounded-md transition-colors duration-(--duration-fast) hover:bg-surface-2',
          'focus-visible:outline-2 focus-visible:outline-ring',
          expanded ? 'h-10 gap-2.5 px-2' : 'mx-auto size-10 justify-center'
        )}
      >
        <span
          aria-hidden
          className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-foreground"
        >
          {toInitials(label)}
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </span>
        {expanded && (
          <>
            <span className="flex-1 truncate text-left text-sm font-medium text-foreground">
              {label}
            </span>
            <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            'absolute z-40 rounded-lg border border-border bg-surface p-1 shadow-lg',
            expanded ? 'bottom-full left-0 right-0 mb-2' : 'bottom-0 left-full ml-2 w-56'
          )}
        >
          {unreadNews !== null && (
            <Link
              href="/dashboard/news"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close(false)
                onNavigate()
              }}
            >
              <Megaphone size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="flex-1">{tNews('buttonLabel')}</span>
              {hasUnread && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
                  {unreadNews}
                </span>
              )}
            </Link>
          )}

          {installMode && (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close(false)
                if (installMode === 'native') void install()
                else openInstallGuide(true)
              }}
            >
              <Download size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              {tInstall('button')}
            </button>
          )}

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
              <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              {t(key)}
            </Link>
          ))}

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
              <PanelLeftClose size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            ) : (
              <PanelLeftOpen size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            )}
            {expanded ? t('collapse') : t('expand')}
          </button>

          <div aria-hidden="true" className="my-1 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close(false)
              onSignOut()
            }}
          >
            <LogOut size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  )
}
