'use client'

import { CalendarClock, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  id: string
  updatedAt: string
  message: string
  dismissLabel: string
}

/**
 * `dismissed` démarre à `true` : sans ça, un visiteur qui a déjà masqué le bandeau le
 * verrait clignoter à l'affichage avant que l'effet ne relise `localStorage`. La clé
 * inclut `updatedAt` (issue #326) : modifier l'événement change la clé, donc le bandeau
 * masqué réapparaît — un identifiant seul ne le permettrait pas.
 */
export function EventAnnouncementBannerClient({ id, updatedAt, message, dismissLabel }: Props) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(`event-dismissed:${id}:${updatedAt}`) === '1')
  }, [id, updatedAt])

  if (dismissed) return null

  return (
    <div className="border-b border-primary/20 bg-primary-subtle px-4 py-2 text-sm text-graphite sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-foreground" />
          <span className="truncate font-medium">{message}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(`event-dismissed:${id}:${updatedAt}`, '1')
            setDismissed(true)
          }}
          aria-label={dismissLabel}
          className="shrink-0 rounded p-1 text-graphite-600 hover:bg-white/60"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
