'use client'

import { useMenu } from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { attendanceNewCallHref } from './attendance-period-href'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Ouvre l'écran d'appel d'une date : il propose les séances du jour ou un appel ponctuel. */
export function AttendanceNewCall({
  classPeriodId,
  today,
  labels,
}: {
  classPeriodId: string
  today: string
  labels: { trigger: string; date: string; open: string; hint: string }
}) {
  const router = useRouter()
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [day, setDay] = useState(today)
  const valid = DATE_PATTERN.test(day) && day <= today

  return (
    <div className="relative print:hidden" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus aria-hidden="true" className="size-4" />
        {labels.trigger}
      </button>
      <div
        ref={menuRef}
        role="dialog"
        aria-label={labels.trigger}
        className={`absolute top-full right-0 z-40 mt-1 w-72 rounded border border-alabaster-700 bg-white p-3 shadow-lg ${open ? '' : 'hidden'}`}
      >
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            close(false)
            router.push(attendanceNewCallHref(classPeriodId, day))
          }}
        >
          <label className="grid gap-1 text-xs text-graphite-600">
            {labels.date}
            <input
              type="date"
              value={day}
              max={today}
              onChange={(event) => setDay(event.target.value)}
              className="h-9 rounded border border-alabaster-600 bg-white px-2 text-sm text-graphite"
            />
          </label>
          <p className="text-xs text-graphite-600">{labels.hint}</p>
          <button
            type="submit"
            disabled={!valid}
            className="h-9 rounded bg-graphite text-sm font-semibold text-white disabled:opacity-50"
          >
            {labels.open}
          </button>
        </form>
      </div>
    </div>
  )
}
