'use client'

import { Button } from '@peaklab/ui'
import { Check } from 'lucide-react'
import { type ReactNode, useState } from 'react'

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
  lateMinutesInvalid: string
  message: string
  messageHint: string
  saving: string
  saved: string
  retry: string
}

const statusLabelKey: Record<AttendanceStatus, 'present' | 'late' | 'absent' | 'unrecorded'> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  NOT_RECORDED: 'unrecorded',
}

export function attendanceStatusLabel(
  status: AttendanceStatus,
  labels: Pick<StudentCardLabels, 'present' | 'late' | 'absent' | 'unrecorded'>
) {
  return labels[statusLabelKey[status]]
}

export function countAttendanceStatuses(
  entries: readonly { status: AttendanceStatus }[]
): Record<AttendanceStatus, number> {
  return entries.reduce(
    (all, entry) => {
      all[entry.status] += 1
      return all
    },
    { NOT_RECORDED: 0, PRESENT: 0, LATE: 0, ABSENT: 0 }
  )
}

/** Borne partagée avec le schéma serveur de `updateAttendanceEntryAction`. */
export const MAX_LATE_MINUTES = 1440

/**
 * Lit la saisie du retard : vide → `null`, entier dans [0, MAX] → nombre, sinon `'invalid'`.
 * `min`/`max` HTML ne bornent que les flèches : une valeur tapée (« -3 ») passe sans ce contrôle.
 */
export function parseLateMinutes(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_LATE_MINUTES
    ? minutes
    : 'invalid'
}

/** Ramène une saisie hors bornes à la valeur valide la plus proche (entier dans [0, MAX]). */
export function clampLateMinutes(value: string): number | null {
  const minutes = Number(value)
  if (value.trim() === '' || !Number.isFinite(minutes)) return null
  return Math.min(MAX_LATE_MINUTES, Math.max(0, Math.round(minutes)))
}

const formatLateMinutes = (minutes: number | null) => (minutes === null ? '' : String(minutes))

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
  onFieldBlur,
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
  onLateMinutes: (value: number | null) => void
  onMessage: (value: string) => void
  onFieldBlur: () => void
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
  const statusLabel = attendanceStatusLabel(entry.status, labels)
  // Brouillon texte du retard : un champ contrôlé par `entry.lateMinutes` remettrait la dernière
  // valeur valide à chaque saisie refusée, rendant le bornage au `blur` inatteignable.
  const [lateMinutesDraft, setLateMinutesDraft] = useState(formatLateMinutes(entry.lateMinutes))
  const [lateMinutesError, setLateMinutesError] = useState(false)
  const [syncedLateMinutes, setSyncedLateMinutes] = useState({
    id: entry.id,
    minutes: entry.lateMinutes,
  })
  // La carte n'est pas remontée entre deux élèves : resynchroniser sur l'élève et sur toute
  // valeur imposée de l'extérieur (statut changé, enregistrement serveur).
  if (syncedLateMinutes.id !== entry.id || syncedLateMinutes.minutes !== entry.lateMinutes) {
    const studentChanged = syncedLateMinutes.id !== entry.id
    setSyncedLateMinutes({ id: entry.id, minutes: entry.lateMinutes })
    if (studentChanged || parseLateMinutes(lateMinutesDraft) !== entry.lateMinutes) {
      setLateMinutesDraft(formatLateMinutes(entry.lateMinutes))
      setLateMinutesError(false)
    }
  }
  const lateMinutesErrorId = `late-minutes-error-${entry.id}`
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
                const text = attendanceStatusLabel(status, labels)
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
            {entry.status === 'LATE' ? (
              <label className="flex items-center gap-3 text-sm font-medium">
                {labels.lateMinutes}
                <input
                  className="h-10 w-24 rounded-lg border border-alabaster bg-white px-3 text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  inputMode="numeric"
                  min="0"
                  max="1440"
                  type="number"
                  step="1"
                  value={lateMinutesDraft}
                  disabled={globalPending}
                  aria-invalid={lateMinutesError || undefined}
                  aria-describedby={lateMinutesError ? lateMinutesErrorId : undefined}
                  onChange={(event) => {
                    const minutes = parseLateMinutes(event.target.value)
                    setLateMinutesDraft(event.target.value)
                    setLateMinutesError(minutes === 'invalid')
                    if (minutes !== 'invalid') onLateMinutes(minutes)
                  }}
                  onBlur={() => {
                    if (parseLateMinutes(lateMinutesDraft) === 'invalid') {
                      const minutes = clampLateMinutes(lateMinutesDraft)
                      setLateMinutesDraft(formatLateMinutes(minutes))
                      setLateMinutesError(false)
                      onLateMinutes(minutes)
                    }
                    onFieldBlur()
                  }}
                />
              </label>
            ) : null}
            {entry.status === 'LATE' && lateMinutesError ? (
              <p id={lateMinutesErrorId} role="alert" className="text-sm text-red-700">
                {labels.lateMinutesInvalid}
              </p>
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
                onBlur={onFieldBlur}
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
