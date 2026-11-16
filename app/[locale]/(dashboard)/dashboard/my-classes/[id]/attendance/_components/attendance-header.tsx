import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import type { AttendanceFrequency } from '@/domain/attendance-frequency'
import type { Labels, Slot } from './attendance-call-model'

export function AttendanceHeader({
  labels,
  className,
  frequency,
  locale,
  occurredOn,
  selectedSlot,
  selectedOccurrence,
  showDateForm,
  globalPending,
  onToggleDateForm,
  onDateSubmit,
}: {
  labels: Labels
  className: string
  frequency: AttendanceFrequency
  locale: string
  occurredOn: string
  selectedSlot?: Slot
  selectedOccurrence?: 'adhoc' | 'daily'
  showDateForm: boolean
  globalPending: boolean
  onToggleDateForm: () => void
  onDateSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const t = useTranslations('dashboard.pages.attendance')
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${occurredOn}T00:00:00.000Z`)
  )
  return (
    <header className="border-b border-alabaster-700 pb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-graphite-600">
        {labels.title}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {className}
        </h1>
        <button
          type="button"
          className="text-sm text-foreground underline underline-offset-4"
          onClick={onToggleDateForm}
        >
          {labels.changeDate}
        </button>
      </div>
      <p className="mt-2 text-sm text-graphite-600">
        {date}
        {frequency !== 'DAILY' && selectedSlot
          ? ` · ${selectedSlot.startTime}–${selectedSlot.endTime}`
          : ''}
        {frequency === 'DAILY'
          ? ` · ${t('dailyCall')}`
          : selectedOccurrence
            ? ` · ${labels.exceptional}`
            : ''}
      </p>
      {showDateForm ? (
        <form method="get" className="mt-3 flex flex-wrap items-end gap-2" onSubmit={onDateSubmit}>
          <label className="text-sm text-graphite-600">
            {labels.date}
            <input
              className="ml-2 h-11 rounded-md border border-graphite-300 bg-white px-2 text-graphite"
              type="date"
              name="date"
              defaultValue={occurredOn}
              readOnly={globalPending}
            />
          </label>
          <Button type="submit" size="sm" disabled={globalPending}>
            {labels.changeDate}
          </Button>
        </form>
      ) : null}
    </header>
  )
}
