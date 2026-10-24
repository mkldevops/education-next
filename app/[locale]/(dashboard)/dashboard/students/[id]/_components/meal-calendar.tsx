'use client'

import { Button, cn } from '@peaklab/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import type { MealDayStatus } from '@/domain/meal-calendar'
import type { MealService } from '@/generated/prisma/enums'
import { toastActionError } from '@/lib/toast'
import { toggleMealAbsenceAction } from '../../../../_lib/meal-actions'

type Props = {
  studentId: string
  service: MealService
  days: Array<{ day: string; status: MealDayStatus }>
  /** Aujourd'hui dans le fuseau de l'école, `YYYY-MM-DD`. */
  today: string
  locale: string
}

const STATUS_CLASS: Record<MealDayStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  due: 'bg-red-100 text-red-800',
  unpaid: 'bg-graphite-900 text-graphite',
  absent: 'bg-amber-100 text-amber-800 line-through',
  closed: 'bg-transparent text-graphite-800',
}

const LEGEND: MealDayStatus[] = ['paid', 'due', 'unpaid', 'absent', 'closed']

/** `YYYY-MM` décalé de `delta` mois. */
function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}

/**
 * Feuille de repas d'un service : un mois, chaque jour prévu avec son état. Un toucher
 * marque l'absence d'un jour servi, un second la retire ; la fiche se recalcule aussitôt.
 */
export function MealCalendar({ studentId, service, days, today, locale }: Props) {
  const t = useTranslations('dashboard.pages.studentDetails.meals.calendar')
  const [isPending, startTransition] = useTransition()
  const first = days[0]?.day.slice(0, 7)
  const last = days.at(-1)?.day.slice(0, 7)
  const initial = today.slice(0, 7)
  const [month, setMonth] = useState(
    first && initial < first ? first : last && initial > last ? last : initial
  )

  if (!first || !last) return null

  const byDay = new Map(days.map((entry) => [entry.day, entry.status]))
  const start = new Date(`${month}-01T00:00:00.000Z`)
  const offset = (start.getUTCDay() || 7) - 1
  const length = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  // Lundi en premier : les cases vides alignent le 1er sur son jour de semaine.
  const blanks = Array.from({ length: offset }, (_, i) => `blank-${i}`)
  const cells = Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    label: new Date(Date.UTC(2026, 0, 4 + weekday)).toLocaleDateString(locale, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
  }))

  const toggle = (day: string, status: MealDayStatus) => {
    startTransition(async () => {
      const result = await toggleMealAbsenceAction({
        studentId,
        service,
        day,
        absent: status !== 'absent',
      })
      if (result !== 'OK') toastActionError(t, result)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= first}
          aria-label={t('previous')}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium capitalize text-graphite">
          {start.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= last}
          aria-label={t('next')}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekdayLabels.map(({ weekday, label }) => (
          <span key={weekday} className="text-graphite-600">
            {label}
          </span>
        ))}
        {blanks.map((key) => (
          <span key={key} />
        ))}
        {cells.map((day) => {
          const status = byDay.get(day)
          const label = String(Number(day.slice(8)))
          if (!status) {
            return (
              <span key={day} className="py-1.5 text-graphite-300">
                {label}
              </span>
            )
          }
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day, status)}
              disabled={isPending || status === 'closed'}
              title={t(`status.${status}`)}
              aria-label={`${day} · ${t(`status.${status}`)}`}
              aria-pressed={status === 'absent'}
              className={cn(
                'rounded py-1.5 font-medium transition-opacity disabled:cursor-default',
                STATUS_CLASS[status],
                day === today && 'ring-1 ring-graphite',
                isPending && 'opacity-60'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-graphite-600">
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1">
            <span className={cn('inline-block size-3 rounded', STATUS_CLASS[status])} />
            {t(`status.${status}`)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-graphite-600">{t('hint')}</p>
    </div>
  )
}
