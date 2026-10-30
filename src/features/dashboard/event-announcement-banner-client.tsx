'use client'

import { CalendarClock, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { eventAnnouncementCookieName } from '@/lib/event-announcement-cookie'

type Props = {
  id: string
  updatedAt: string
  message: string
  dismissLabel: string
  initialDismissed?: boolean
}

function persistDismissal(cookieName: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: synchronous preference, including older iOS browsers without Cookie Store API.
  document.cookie = `${cookieName}=1; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

/** The server knows the cookie preference before paint; old localStorage choices migrate once. */
export function EventAnnouncementBannerClient({
  id,
  updatedAt,
  message,
  dismissLabel,
  initialDismissed = false,
}: Props) {
  const [dismissed, setDismissed] = useState(initialDismissed)
  const cookieName = eventAnnouncementCookieName(id, updatedAt)

  useEffect(() => {
    let legacyDismissed = false
    try {
      legacyDismissed = window.localStorage.getItem(`event-dismissed:${id}:${updatedAt}`) === '1'
    } catch {}
    setDismissed(initialDismissed || legacyDismissed)
    if (legacyDismissed) {
      persistDismissal(cookieName)
    }
  }, [id, updatedAt, initialDismissed, cookieName])

  if (dismissed) return null

  return (
    <div className="border-b border-primary/20 bg-primary-light px-4 py-2 text-sm text-graphite sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{message}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            persistDismissal(cookieName)
            try {
              window.localStorage.setItem(`event-dismissed:${id}:${updatedAt}`, '1')
            } catch {}
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
