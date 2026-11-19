'use client'

import { useMenu } from '@peaklab/ui'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { attendancePeriodHref } from './attendance-period-href'

type RangeItem = { value: string; label: string; dates: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function AttendanceRangeMenu({
  current,
  from,
  to,
  classId,
  items,
  labels,
}: {
  current: string
  from: string
  to: string
  classId?: string
  items: RangeItem[]
  labels: {
    trigger: string
    dates: string
    custom: string
    from: string
    to: string
    apply: string
  }
}) {
  const router = useRouter()
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [customOpen, setCustomOpen] = useState(current === 'custom')
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)
  const customValid = DATE_PATTERN.test(customFrom) && DATE_PATTERN.test(customTo)

  const go = (range: string, bounds?: { from: string; to: string }) => {
    close(false)
    router.push(attendancePeriodHref({ range, ...bounds, classId }))
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 items-center gap-2 rounded border border-alabaster-600 bg-white px-3 text-sm font-semibold text-graphite hover:bg-alabaster-800"
      >
        <CalendarDays aria-hidden="true" className="size-4" />
        {labels.trigger}
        <span className="font-normal text-graphite-600">{labels.dates}</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      <div
        ref={menuRef}
        role="menu"
        className={`absolute top-full left-0 z-40 mt-1 w-72 rounded border border-alabaster-700 bg-white p-1 shadow-lg ${open ? '' : 'hidden'}`}
      >
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="menuitem"
            onClick={() => go(item.value)}
            className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-alabaster-800 focus:bg-alabaster-800 focus:outline-none"
          >
            <Check
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 ${item.value === current ? '' : 'invisible'}`}
            />
            <span>
              <span className="block font-medium text-graphite">{item.label}</span>
              <span className="block text-xs text-graphite-600">{item.dates}</span>
            </span>
          </button>
        ))}
        <div className="my-1 border-t border-alabaster-700" />
        <button
          type="button"
          role="menuitem"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm font-medium text-graphite hover:bg-alabaster-800 focus:bg-alabaster-800 focus:outline-none"
        >
          <Check
            aria-hidden="true"
            className={`size-4 shrink-0 ${current === 'custom' ? '' : 'invisible'}`}
          />
          {labels.custom}
        </button>
        {customOpen && (
          <form
            className="grid gap-2 px-2 pt-1 pb-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (customValid) go('custom', { from: customFrom, to: customTo })
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-graphite-600">
                {labels.from}
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-9 rounded border border-alabaster-600 bg-white px-2 text-sm text-graphite"
                />
              </label>
              <label className="grid gap-1 text-xs text-graphite-600">
                {labels.to}
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-9 rounded border border-alabaster-600 bg-white px-2 text-sm text-graphite"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={!customValid}
              className="h-9 rounded bg-graphite text-sm font-semibold text-white disabled:opacity-50"
            >
              {labels.apply}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
