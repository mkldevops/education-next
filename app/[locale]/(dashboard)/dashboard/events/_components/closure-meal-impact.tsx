'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { parseEventInputValue } from '@/lib/date'
import { previewClosureMealImpactAction } from '../../../_lib/event-actions'

const MEAL_CLOSURE_CATEGORIES = ['CLOSURE', 'HOLIDAY']

type Impact = { children: number; moved: number }

type Props = {
  eventId?: string
  category: string
  startAt: string
  endAt: string
}

/** Repas touchés par la fermeture en cours de saisie, recalculés quand dates ou catégorie changent. */
export function ClosureMealImpact({ eventId, category, startAt, endAt }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const [impact, setImpact] = useState<Impact | null>(null)
  const applies = MEAL_CLOSURE_CATEGORIES.includes(category) && startAt !== ''

  useEffect(() => {
    if (!applies) return
    let current = true
    const timer = setTimeout(() => {
      previewClosureMealImpactAction({
        eventId,
        startAt: parseEventInputValue(startAt),
        endAt: endAt ? parseEventInputValue(endAt) : null,
      }).then(
        (result) => current && setImpact(result),
        () => current && setImpact(null)
      )
    }, 300)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [applies, eventId, startAt, endAt])

  if (!applies || !impact) return null
  return (
    <p role="status" className="rounded-md bg-alabaster-900 px-3 py-2 text-sm text-graphite-600">
      {t('mealImpact', impact)}
    </p>
  )
}
