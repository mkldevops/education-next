'use client'

import { Loader2, Search, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { searchStudentsAndFamilies } from '@/services/search-service'

const SEARCH_DEBOUNCE_MS = 250

export type ChatFamily = { id: string; name: string }

type Props = {
  value: ChatFamily | null
  onChange: (family: ChatFamily | null) => void
  disabled?: boolean
}

/**
 * Famille de contexte de la conversation, choisie comme on mentionne quelqu'un. La
 * recherche réutilise celle de la palette, déjà cantonnée à l'école ; la route revérifie
 * la famille à chaque tour.
 */
export function FamilyPicker({ value, onChange, disabled }: Props) {
  const t = useTranslations('dashboard.assistant.chat.family')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatFamily[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (!open || trimmed === '') {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const found = await searchStudentsAndFamilies(trimmed).catch(() => [])
      if (cancelled) return
      setResults(
        Array.isArray(found)
          ? found.flatMap((item) =>
              item.type === 'family' ? [{ id: item.id, name: item.name }] : []
            )
          : []
      )
      setLoading(false)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query])

  const choose = (family: ChatFamily) => {
    onChange(family)
    setOpen(false)
    setQuery('')
  }

  if (value) {
    return (
      <span className="inline-flex h-8 max-w-48 items-center gap-1.5 rounded-full border border-primary/40 bg-primary-subtle pl-3 pr-1 text-xs font-medium">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate" title={value.name}>
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="rounded-full p-1 hover:bg-surface-2"
          aria-label={t('clear', { name: value.name })}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
      >
        <Users className="h-4 w-4" aria-hidden />
        {t('choose')}
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="flex items-center gap-2 rounded-lg border border-input px-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              // biome-ignore lint/a11y/noAutofocus: la recherche s'ouvre sur demande explicite
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (results[0]) choose(results[0])
                }
              }}
              placeholder={t('search')}
              aria-label={t('search')}
              aria-controls={listId}
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          </div>
          <ul id={listId} aria-label={t('results')} className="mt-1 max-h-60 overflow-y-auto">
            {results.map((family, index) => (
              <li key={family.id}>
                <button
                  type="button"
                  onClick={() => choose(family)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2',
                    index === 0 && 'bg-surface-2/60'
                  )}
                >
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{family.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && query.trim() !== '' && results.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{t('none')}</p>
          ) : null}
          {query.trim() === '' ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{t('hint')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
