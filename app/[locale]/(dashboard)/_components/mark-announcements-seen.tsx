'use client'

import { useEffect, useRef } from 'react'
import { markAnnouncementsSeenAction } from '../_lib/announcement-actions'

/** Ouvrir `/dashboard/news` vaut lecture : la pastille de l'en-tête s'éteint. */
export function MarkAnnouncementsSeen() {
  const recorded = useRef(false)

  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    void markAnnouncementsSeenAction()
  }, [])

  return null
}
