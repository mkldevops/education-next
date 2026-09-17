'use client'

import { Button } from '@peaklab/ui'
import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@/i18n/routing'
import type { AttendanceEntry, AttendanceStatus } from './student-attendance-card'

type ReviewLabels = {
  present: string
  late: string
  absent: string
  unrecorded: string
  summary: string
  reviewAttendance: string
  reviewSubtitle: string
  partialWarning: string
  partialWarningSingle: string
  completeStudents: string
  completeStudent: string
  all: string
  edit: string
  returnToEntry: string
  validate: string
  validatePartial: string
  validatedStatus: string
  correctAttendance: string
  returnClasses: string
}

export function AttendanceReview({
  entries,
  labels,
  onReturn,
  onComplete,
  onEdit,
  onValidate,
  validating,
  validated,
  onCorrect,
}: {
  entries: AttendanceEntry[]
  labels: ReviewLabels
  onReturn: () => void
  onComplete: () => void
  onEdit: (id: string) => void
  onValidate: () => void
  validating: boolean
  validated: boolean
  onCorrect: () => void
}) {
  const [filter, setFilter] = useState<AttendanceStatus | 'ALL'>('ALL')
  const counts = entries.reduce(
    (all, entry) => {
      all[entry.status] += 1
      return all
    },
    { NOT_RECORDED: 0, PRESENT: 0, LATE: 0, ABSENT: 0 }
  )
  const rows = filter === 'ALL' ? entries : entries.filter((entry) => entry.status === filter)
  const name = (status: AttendanceStatus) =>
    status === 'PRESENT'
      ? labels.present
      : status === 'LATE'
        ? labels.late
        : status === 'ABSENT'
          ? labels.absent
          : labels.unrecorded
  return (
    <section
      className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-alabaster-700 bg-white shadow-[0_18px_50px_-34px_rgba(53,53,53,0.42)]"
      aria-label={labels.summary}
    >
      <header className="border-b border-alabaster-800 p-5 sm:p-7">
        <p
          role={validated ? 'status' : undefined}
          className={`text-xs font-semibold uppercase tracking-[0.16em] ${validated ? 'text-emerald-800' : 'text-graphite-600'}`}
        >
          {validated ? labels.validatedStatus : labels.reviewAttendance}
        </p>
        <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
          {labels.summary}
        </h2>
        {!validated ? (
          <p className="mt-1 text-sm text-graphite-600">{labels.reviewSubtitle}</p>
        ) : null}
      </header>
      <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 sm:p-7">
        {(['PRESENT', 'LATE', 'ABSENT', 'NOT_RECORDED'] as const).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
            className={`rounded-xl border p-3 text-left text-sm transition-colors ${filter === status ? 'ring-2 ring-primary ring-offset-1' : ''} ${status === 'PRESENT' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : status === 'LATE' ? 'border-amber-200 bg-amber-50 text-amber-950' : status === 'ABSENT' ? 'border-red-200 bg-red-50 text-red-950' : 'border-alabaster-700 bg-alabaster-900 text-graphite'}`}
          >
            <strong className="block text-xl">{counts[status]}</strong>
            {name(status)}
          </button>
        ))}
      </div>
      {counts.NOT_RECORDED > 0 ? (
        <div
          role="alert"
          className="mx-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:mx-7"
        >
          <strong>
            {(counts.NOT_RECORDED === 1
              ? labels.partialWarningSingle
              : labels.partialWarning
            ).replace('{count}', String(counts.NOT_RECORDED))}
          </strong>
          {!validated ? (
            <button
              type="button"
              disabled={validating}
              className="ml-2 underline underline-offset-4"
              onClick={onComplete}
            >
              {(counts.NOT_RECORDED === 1
                ? labels.completeStudent
                : labels.completeStudents
              ).replace('{count}', String(counts.NOT_RECORDED))}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-7">
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-full px-3 py-1 text-xs text-graphite-600 underline"
            aria-pressed={filter === 'ALL'}
            disabled={validating}
            onClick={() => setFilter('ALL')}
          >
            {labels.all}
          </button>
        </div>
        <span className="text-xs text-graphite-600">
          {rows.length} / {entries.length}
        </span>
      </div>
      <ul className="divide-y divide-alabaster-800 px-5 sm:px-7">
        {rows.map((entry) => (
          <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="break-words font-medium">
                {entry.studentName}{' '}
                <span
                  className={`ml-1 inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${entry.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-900' : entry.status === 'LATE' ? 'bg-amber-50 text-amber-950' : entry.status === 'ABSENT' ? 'bg-red-50 text-red-900' : 'bg-alabaster-900 text-graphite-600'}`}
                >
                  {name(entry.status)}
                </span>
                {entry.status === 'LATE' && entry.lateMinutes !== null ? (
                  <span className="ml-1 whitespace-nowrap text-xs text-amber-800">
                    {entry.lateMinutes} min
                  </span>
                ) : null}
              </p>
              {entry.message ? (
                <p className="mt-1 flex min-w-0 gap-1 whitespace-pre-wrap break-words text-sm text-graphite-600">
                  <MessageSquare aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                  <span className="min-w-0 break-words">{entry.message}</span>
                </p>
              ) : null}
            </div>
            {!validated ? (
              <button
                type="button"
                aria-label={`${labels.edit} ${entry.studentName}`}
                className="shrink-0 text-xs text-primary underline"
                disabled={validating}
                onClick={() => onEdit(entry.id)}
              >
                {labels.edit}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-alabaster-800 p-5 sm:p-7">
        {!validated ? (
          <Button variant="outline" disabled={validating} onClick={onReturn}>
            {labels.returnToEntry}
          </Button>
        ) : null}
        {validated ? (
          <>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary underline"
              href="/dashboard/my-classes"
            >
              {labels.returnClasses}
            </Link>
            <Button onClick={onCorrect}>{labels.correctAttendance}</Button>
          </>
        ) : (
          <Button disabled={validating} onClick={onValidate}>
            {counts.NOT_RECORDED > 0 ? labels.validatePartial : labels.validate}
          </Button>
        )}
      </footer>
    </section>
  )
}
