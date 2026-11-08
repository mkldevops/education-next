'use client'

import { cn, Input } from '@peaklab/ui'
import { Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Link, useRouter } from '@/i18n/routing'

export type CashierSearchResult = { id: string; name: string; children: string[] }

type Props = {
  query: string
  /** Familles trouvées pour `query`, `null` tant que la recherche n'a pas deux caractères. */
  results: CashierSearchResult[] | null
  /** Lien vers la liste des familles, proposé quand la recherche ne trouve rien. */
  canListFamilies: boolean
}

const MIN_LENGTH = 2
const DEBOUNCE_MS = 250

const familyHref = (id: string) => `/dashboard/cashier?familyId=${id}`

/**
 * Recherche de la caisse : les résultats suivent la saisie, sans bouton. Le champ prend le
 * focus à l'arrivée et sur « / », les flèches choisissent une famille, Entrée l'ouvre.
 */
export function CashierSearch({ query, results, canListFamilies }: Props) {
  const t = useTranslations('dashboard.pages.cashier')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(query)
  const [active, setActive] = useState(0)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed === query) return
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(
          trimmed.length >= MIN_LENGTH
            ? `/dashboard/cashier?q=${encodeURIComponent(trimmed)}`
            : '/dashboard/cashier'
        )
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, query, router])

  const [shownResults, setShownResults] = useState(results)
  if (shownResults !== results) {
    setShownResults(results)
    setActive(0)
  }

  const open = (id: string) => router.push(familyHref(id))

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = results[active]
      if (target) open(target.id)
    }
  }

  const listId = 'cashier-search-results'
  const showResults = results !== null && value.trim().length >= MIN_LENGTH

  return (
    <search className="max-w-2xl space-y-2">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="flex items-center gap-2 rounded-lg border-2 border-primary bg-white px-3 ring-4 ring-primary/10"
      >
        <Search className="h-5 w-5 shrink-0 text-graphite-600" aria-hidden />
        <Input
          ref={inputRef}
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('search')}
          aria-label={t('search')}
          aria-controls={listId}
          autoComplete="off"
          className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        />
        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-graphite-600" aria-hidden />
        ) : (
          <kbd className="hidden rounded border border-alabaster-700 px-1.5 font-mono text-xs text-graphite-600 sm:inline">
            /
          </kbd>
        )}
      </form>

      {showResults &&
        (results.length === 0 ? (
          <div className="rounded-lg border border-alabaster-700 p-4 text-sm">
            <p className="font-medium text-graphite">{t('noResultFor', { query })}</p>
            <ul className="mt-2 space-y-1 text-graphite-600">
              <li>{t('noResultTips.child')}</li>
              <li>{t('noResultTips.active')}</li>
              {canListFamilies && (
                <li>
                  <Link
                    href="/dashboard/families"
                    className="font-medium text-foreground underline"
                  >
                    {t('noResultTips.families')}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        ) : (
          <>
            <ul
              id={listId}
              aria-label={t('search')}
              className="divide-y divide-alabaster-700 overflow-hidden rounded-lg border border-alabaster-700"
            >
              {results.map((result, index) => (
                <li key={result.id}>
                  <Link
                    href={familyHref(result.id)}
                    onMouseEnter={() => setActive(index)}
                    aria-current={index === active ? 'true' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 hover:bg-alabaster-900',
                      index === active && 'bg-primary/5'
                    )}
                  >
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-alabaster-900 text-xs font-bold text-primary"
                    >
                      {result.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-graphite">
                        {result.name}
                      </span>
                      {result.children.length > 0 && (
                        <span className="block truncate text-xs text-graphite-600">
                          {result.children.join(' · ')}
                        </span>
                      )}
                    </span>
                    {index === active && (
                      <kbd className="font-mono text-xs text-graphite-600" aria-hidden>
                        ↵
                      </kbd>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-graphite-600">{t('searchHint')}</p>
          </>
        ))}
    </search>
  )
}
