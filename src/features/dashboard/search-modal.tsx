'use client'

import { Command } from 'cmdk'
import { User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { searchStudentsAndFamilies } from '@/services/search-service'

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

interface SearchModalProps {
  onClose?: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter()
  const t = useTranslations('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
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
        if (!cancelled) setResults(Array.isArray(response) ? response : [])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'student') {
      router.push(`/dashboard/students/${result.id}`)
    } else {
      router.push(`/dashboard/families/${result.id}`)
    }
    onClose?.()
    setQuery('')
    setResults([])
  }

  const groupedResults = {
    families: results.filter((r) => r.type === 'family'),
    students: results.filter((r) => r.type === 'student'),
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24"
      onClick={() => onClose?.()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose?.()
        }
      }}
    >
      <div
        role="document"
        className="w-full max-w-2xl mx-4 bg-white rounded shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
        }}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-4 py-3">
            <input
              className="flex-1 outline-none text-sm placeholder-graphite-500"
              placeholder={t('placeholder')}
              value={query}
              // biome-ignore lint/a11y/noAutofocus: Modal input needs autofocus for UX
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-graphite-600">{t('loading')}</div>
            )}

            {!isLoading && query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-graphite-600">
                {t('noResults')}
              </div>
            )}

            {!isLoading && query && groupedResults.families.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-graphite-600 uppercase bg-alabaster-50">
                  {t('families')}
                </div>
                {groupedResults.families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-alabaster-50 text-left transition-colors border-b last:border-b-0"
                    onClick={() => handleSelect(family)}
                  >
                    <Users className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-graphite-900 truncate">
                        {family.name}
                      </div>
                      <div className="text-xs text-graphite-600 truncate">
                        {t('memberCount', { count: family.memberCount })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isLoading && query && groupedResults.students.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-graphite-600 uppercase bg-alabaster-50">
                  {t('students')}
                </div>
                {groupedResults.students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-alabaster-50 text-left transition-colors border-b last:border-b-0"
                    onClick={() => handleSelect(student)}
                  >
                    <User className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-graphite-900 truncate">
                        {student.name}
                      </div>
                      {student.secondaryInfo && (
                        <div className="text-xs text-graphite-600 truncate">
                          {student.secondaryInfo}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Command>
      </div>
    </div>
  )
}
