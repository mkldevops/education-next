'use client'

import { Button } from '@peaklab/ui'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export type AttendanceStatus = 'NOT_RECORDED' | 'PRESENT' | 'LATE' | 'ABSENT'
export type AttendanceEntry = {
  id: string
  studentName: string
  status: AttendanceStatus
  lateMinutes: number | null
  message: string | null
}
export type StudentCardLabels = {
  present: string
  late: string
  absent: string
  unrecorded: string
  lateMinutes: string
  message: string
  messageHint: string
  saving: string
  saved: string
  retry: string
}

const statusStyles = {
  PRESENT: 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100',
  LATE: 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100',
  ABSENT: 'border-red-200 bg-red-50 text-red-950 hover:bg-red-100',
} as const

export function StudentAttendanceCard({
  entry,
  labels,
  editing,
  pending,
  globalPending,
  error,
  saved,
  inputRef,
  onStatus,
  onLateMinutes,
  onMessage,
  onMessageBlur,
  onRetry,
  footer,
}: {
  entry: AttendanceEntry
  labels: StudentCardLabels
  editing: boolean
  pending: boolean
  globalPending: boolean
  error?: string
  saved: boolean
  inputRef?: (node: HTMLButtonElement | null) => void
  onStatus: (status: AttendanceStatus) => void
  onLateMinutes: (value: string) => void
  onMessage: (value: string) => void
  onMessageBlur: () => void
  onRetry: () => void
  footer?: ReactNode
}) {
  const initials = entry.studentName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const statusLabel =
    entry.status === 'PRESENT'
      ? labels.present
      : entry.status === 'LATE'
        ? labels.late
        : entry.status === 'ABSENT'
          ? labels.absent
          : labels.unrecorded
  return (
    <article className="overflow-hidden rounded-3xl border border-alabaster-700 bg-white shadow-[0_18px_50px_-34px_rgba(53,53,53,0.42)]">
      <div className="space-y-5 p-5 sm:p-8">
        <header className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-alabaster-900 text-xs font-semibold tracking-wide text-graphite-600"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="break-words font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {entry.studentName}
            </p>
            {!editing ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-graphite-600">
                {statusLabel}
              </p>
            ) : null}
          </div>
        </header>
        {editing ? (
          <>
            <section aria-label={entry.studentName} className="grid grid-cols-3 gap-2">
              {(['PRESENT', 'LATE', 'ABSENT'] as const).map((status, index) => {
                const text =
                  status === 'PRESENT'
                    ? labels.present
                    : status === 'LATE'
                      ? labels.late
                      : labels.absent
                return (
                  <Button
                    key={status}
                    ref={index === 0 ? inputRef : undefined}
                    variant="outline"
                    className={`h-auto min-h-14 min-w-0 flex-col gap-1 whitespace-normal border px-1 py-2 text-xs transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none sm:flex-row sm:text-sm ${entry.status === status ? statusStyles[status] : 'border-alabaster-700 bg-white text-graphite hover:bg-alabaster-900'}`}
                    disabled={globalPending || pending}
                    aria-pressed={entry.status === status}
                    onClick={() => onStatus(status)}
                  >
                    {status === 'PRESENT' ? (
                      <Check aria-hidden="true" className="size-4 shrink-0" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid size-4 shrink-0 place-items-center text-base leading-none"
                      >
                        {status === 'LATE' ? '◷' : '×'}
                      </span>
                    )}
                    <span className="truncate">{text}</span>
                    {entry.status === status ? (
                      <Check aria-hidden="true" className="hidden size-3 sm:block" />
                    ) : null}
                  </Button>
                )
              })}
            </section>
            <button
              type="button"
              className="text-xs text-graphite-600 underline underline-offset-4"
              disabled={globalPending || pending}
              onClick={() => onStatus('NOT_RECORDED')}
            >
              {labels.unrecorded}
            </button>
            {entry.status === 'LATE' ? (
              <label className="flex items-center gap-3 text-sm font-medium">
                {labels.lateMinutes}
                <input
                  className="h-10 w-24 rounded-lg border border-alabaster bg-white px-3 text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  inputMode="numeric"
                  min="0"
                  max="1440"
                  type="number"
                  value={entry.lateMinutes ?? ''}
                  disabled={globalPending}
                  onChange={(event) => onLateMinutes(event.target.value)}
                  onBlur={onMessageBlur}
                />
              </label>
            ) : null}
            <div>
              <label htmlFor={`message-${entry.id}`} className="text-sm font-medium">
                {labels.message}
              </label>
              <textarea
                id={`message-${entry.id}`}
                aria-describedby={`message-hint-${entry.id}`}
                className="mt-2 min-h-20 w-full resize-y rounded-xl border border-alabaster bg-alabaster-900/40 px-3 py-2 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={entry.message ?? ''}
                disabled={globalPending}
                maxLength={1000}
                onChange={(event) => onMessage(event.target.value)}
                onBlur={onMessageBlur}
              />
              <span
                id={`message-hint-${entry.id}`}
                className="mt-1 block text-xs text-graphite-600"
              >
                {labels.messageHint}
              </span>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm text-graphite-700">
            {entry.status === 'LATE' && entry.lateMinutes !== null ? (
              <p>
                {labels.lateMinutes}: {entry.lateMinutes}
              </p>
            ) : null}
            {entry.message ? <p className="whitespace-pre-wrap">{entry.message}</p> : null}
          </div>
        )}
        <p aria-live="polite" className="min-h-5 text-xs text-graphite-600">
          {pending ? labels.saving : saved ? labels.saved : ''}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}{' '}
            <button type="button" className="font-medium underline" onClick={onRetry}>
              {labels.retry}
            </button>
          </p>
        ) : null}
      </div>
      {footer ? (
        <footer className="border-t border-alabaster-800 bg-alabaster-900/45 px-4 py-3 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </article>
  )
}
