'use client'

import { Command } from 'cmdk'
import { CornerDownLeft, LoaderCircle, Search, User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { searchStudentsAndFamilies } from '@/services/search-service'
import { matchesQuery, resolvePaletteActions } from './palette-actions'
import { flattenNavItems, resolveNavItems } from './sidebar-items'
import { useSidebarStore } from './sidebar-store'

const SEARCH_DEBOUNCE_MS = 300

type SearchResult =
  | {
      type: 'family'
      id: string
      name: string
      memberCount: number
    }
  | {
      type: 'student'
      id: string
      name: string
      secondaryInfo: string
    }

type SearchError = 'unauthorized' | 'validationError' | 'requestFailed'

const ERROR_MESSAGE_KEYS: Record<SearchError, string> = {
  unauthorized: 'errorUnauthorized',
  validationError: 'errorValidation',
  requestFailed: 'errorGeneric',
}

const groupClass = cn(
  'px-2 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5',
  '[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase',
  '[&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-muted-foreground'
)

const itemClass = cn(
  'group flex h-10 cursor-pointer select-none items-center gap-3 rounded-md px-2 text-sm text-foreground',
  'data-[selected=true]:bg-surface-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
)

const iconClass = 'shrink-0 text-muted-foreground group-data-[selected=true]:text-foreground'

interface SearchModalProps {
  onClose?: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter()
  const t = useTranslations('search')
  const tNav = useTranslations('dashboard.sidebar')
  const navScope = useSidebarStore((state) => state.navScope)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<SearchError | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setError(null)

    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await searchStudentsAndFamilies(query)
        if (cancelled) return
        if (response === 'unauthorized' || response === 'validationError') {
          setResults([])
          setError(response)
        } else {
          setResults(response)
        }
      } catch {
        if (!cancelled) {
          setResults([])
          setError('requestFailed')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [query])

  // Piège de focus : la palette est une liste pilotée au clavier depuis son champ. Tab n'a donc
  // nulle part où aller ; le focus reste dans le champ et revient au déclencheur à la fermeture.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  const navigate = (href: string) => {
    router.push(href)
    onClose?.()
    setQuery('')
    setResults([])
  }

  const navItems = navScope
    ? flattenNavItems(resolveNavItems(navScope)).filter((item) =>
        matchesQuery(tNav(item.key), query)
      )
    : []
  const actions = navScope
    ? resolvePaletteActions(navScope).filter((action) =>
        matchesQuery(t(`actions.${action.key}`), query)
      )
    : []

  const families = results.filter((r) => r.type === 'family')
  const students = results.filter((r) => r.type === 'student')
  const hasQuery = query.trim().length > 0
  const hasStaticMatches = navItems.length > 0 || actions.length > 0
  const showNoResults =
    hasQuery && !isLoading && !error && results.length === 0 && !hasStaticMatches

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
        onClick={() => onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      >
        <Command shouldFilter={false} loop label={t('title')}>
          <div className="flex h-12 items-center gap-3 border-b border-border px-4">
            {isLoading ? (
              <LoaderCircle
                size={18}
                aria-hidden="true"
                className="shrink-0 animate-spin text-muted-foreground"
              />
            ) : (
              <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            )}
            <Command.Input
              ref={inputRef}
              className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-placeholder"
              placeholder={t('placeholder')}
              value={query}
              autoFocus
              onValueChange={setQuery}
            />
            <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain py-1">
            {isLoading && results.length === 0 && !hasStaticMatches && (
              <div role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('loading')}
              </div>
            )}

            {!isLoading && hasQuery && error && (
              <div role="alert" className="px-4 py-8 text-center text-sm text-danger">
                {t(ERROR_MESSAGE_KEYS[error])}
              </div>
            )}

            {showNoResults && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('noResults')}
              </div>
            )}

            {actions.length > 0 && (
              <Command.Group heading={t('groupActions')} className={groupClass}>
                {actions.map((action) => (
                  <Command.Item
                    key={action.key}
                    value={`action-${action.key}`}
                    onSelect={() => navigate(action.href)}
                    className={itemClass}
                  >
                    <action.icon size={18} aria-hidden="true" className={iconClass} />
                    <span className="flex-1 truncate">{t(`actions.${action.key}`)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {navItems.length > 0 && (
              <Command.Group heading={t('groupNavigation')} className={groupClass}>
                {navItems.map((item) => (
                  <Command.Item
                    key={item.key}
                    value={`nav-${item.key}`}
                    onSelect={() => navigate(item.href)}
                    className={itemClass}
                  >
                    <item.icon size={18} aria-hidden="true" className={iconClass} />
                    <span className="flex-1 truncate">{tNav(item.key)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {hasQuery && !error && families.length > 0 && (
              <Command.Group heading={t('families')} className={groupClass}>
                {families.map((family) => (
                  <Command.Item
                    key={family.id}
                    value={`family-${family.id}`}
                    onSelect={() => navigate(`/dashboard/families/${family.id}`)}
                    className={itemClass}
                  >
                    <Users size={18} aria-hidden="true" className={iconClass} />
                    <span className="flex-1 truncate">{family.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('memberCount', { count: family.memberCount })}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {hasQuery && !error && students.length > 0 && (
              <Command.Group heading={t('students')} className={groupClass}>
                {students.map((student) => (
                  <Command.Item
                    key={student.id}
                    value={`student-${student.id}`}
                    onSelect={() => navigate(`/dashboard/students/${student.id}`)}
                    className={itemClass}
                  >
                    <User size={18} aria-hidden="true" className={iconClass} />
                    <span className="flex-1 truncate">{student.name}</span>
                    {student.secondaryInfo && (
                      <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                        {student.secondaryInfo}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between gap-4 border-t border-border bg-background px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-surface px-1 font-sans">↑</kbd>
              <kbd className="rounded border border-border bg-surface px-1 font-sans">↓</kbd>
              {t('hintNavigate')}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="flex items-center rounded border border-border bg-surface px-1">
                <CornerDownLeft size={11} aria-hidden="true" />
              </kbd>
              {t('hintOpen')}
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
