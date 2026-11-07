'use client'

import { Check, MessageSquare, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  AbsenceReasonChips,
  type AbsenceReasonOption,
  type AbsenceReasonPicker,
  type AttendanceEntry,
  type AttendanceStatus,
  attendanceStatusLabel,
  countAttendanceStatuses,
  parseLateMinutes,
  type StudentCardLabels,
} from './student-attendance-card'

type Filter = AttendanceStatus | 'ALL'

const LATE_PRESETS = [5, 10, 15, 20, 30] as const
const FILTERS: Filter[] = ['ALL', 'NOT_RECORDED', 'PRESENT', 'LATE', 'ABSENT']

const markStyles = {
  PRESENT: { on: 'border-emerald-600 bg-emerald-600 text-white', short: 'P' },
  LATE: { on: 'border-amber-500 bg-amber-500 text-white', short: 'R' },
  ABSENT: { on: 'border-red-600 bg-red-600 text-white', short: 'A' },
} as const

const rowTint: Record<AttendanceStatus, string> = {
  NOT_RECORDED: '',
  PRESENT: '',
  LATE: 'bg-amber-50/60',
  ABSENT: 'bg-red-50/60',
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const initialLetter = (name: string) =>
  name.trim().charAt(0).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

const matches = (name: string, query: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .includes(query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim())

export function AttendanceList({
  entries,
  labels,
  editing,
  pending,
  globalPending,
  errors,
  reasonPicker,
  reasonRequired,
  onStatus,
  onReason,
  onLateMinutes,
  onMessage,
  onFieldBlur,
  onRetry,
  onMarkRemaining,
  onReview,
  canFinish,
}: {
  entries: AttendanceEntry[]
  labels: StudentCardLabels
  editing: boolean
  pending: ReadonlySet<string>
  globalPending: boolean
  errors: Record<string, string>
  reasonPicker?: AbsenceReasonPicker
  reasonRequired: boolean
  onStatus: (id: string, status: AttendanceStatus) => void
  onReason: (id: string, reason: AbsenceReasonOption | null) => void
  onLateMinutes: (id: string, minutes: number | null) => void
  onMessage: (id: string, message: string) => void
  onFieldBlur: (id: string) => void
  onRetry: (id: string) => void
  onMarkRemaining: () => void
  onReview: () => void
  canFinish: boolean
}) {
  const t = useTranslations('dashboard.pages.attendance')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [noteIds, setNoteIds] = useState<ReadonlySet<string>>(new Set())
  const counts = countAttendanceStatuses(entries)
  const recorded = entries.length - counts.NOT_RECORDED
  const rows = entries.filter(
    (entry) =>
      (filter === 'ALL' || entry.status === filter) && (!query || matches(entry.studentName, query))
  )
  const filterLabel = (value: Filter) =>
    value === 'ALL'
      ? t('all')
      : value === 'NOT_RECORDED'
        ? t('list.toRecord')
        : attendanceStatusLabel(value, labels)
  const mark = (entry: AttendanceEntry, status: Exclude<AttendanceStatus, 'NOT_RECORDED'>) => {
    const next = entry.status === status ? 'NOT_RECORDED' : status
    onStatus(entry.id, next)
    setOpenId(next === 'ABSENT' || next === 'LATE' ? entry.id : null)
  }
  const showNote = (id: string) => setNoteIds((current) => new Set(current).add(id))
  let previousLetter = ''

  return (
    <section aria-label={t('list.label')} className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-alabaster-700 bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:border sm:px-4">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-sm font-medium tabular-nums">
            {recorded} / {entries.length}
          </p>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-alabaster-700"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${entries.length ? (recorded / entries.length) * 100 : 0}%` }}
            />
          </div>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full text-graphite-600 hover:bg-alabaster-900"
            aria-label={searching ? t('list.closeSearch') : t('list.search')}
            aria-expanded={searching}
            onClick={() => {
              setSearching((open) => !open)
              setQuery('')
            }}
          >
            {searching ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Search aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
        {searching ? (
          <input
            type="search"
            // biome-ignore lint/a11y/noAutofocus: the field opens on an explicit tap of the search button
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('list.searchPlaceholder')}
            aria-label={t('list.search')}
            className="h-11 w-full rounded-xl border border-alabaster bg-white px-3 text-base text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : null}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm ${filter === value ? 'border-graphite bg-graphite text-white' : 'border-alabaster-700 bg-white text-graphite'}`}
            >
              {filterLabel(value)}
              <span className="tabular-nums opacity-70">
                {value === 'ALL' ? entries.length : counts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-alabaster-800 border-alabaster-700 bg-white sm:border-x">
        {rows.length === 0 ? (
          <li className="p-6 text-center text-sm text-graphite-600">{t('list.noMatch')}</li>
        ) : null}
        {rows.map((entry) => {
          const letter = initialLetter(entry.studentName)
          const header = filter === 'ALL' && !query && letter !== previousLetter ? letter : null
          previousLetter = letter
          const busy = globalPending || pending.has(entry.id)
          const open = openId === entry.id && editing
          const missingReason =
            reasonRequired && entry.status === 'ABSENT' && !entry.absenceReasonId
          const detail =
            entry.status === 'ABSENT'
              ? (entry.absenceReasonLabel ?? (missingReason ? t('list.reasonMissing') : null))
              : entry.status === 'LATE' && entry.lateMinutes !== null
                ? t('list.lateBy', { minutes: entry.lateMinutes })
                : null
          return (
            <li key={entry.id} className={rowTint[entry.status]}>
              {header ? (
                <p
                  aria-hidden="true"
                  className="bg-alabaster-900 px-4 py-1 text-xs font-semibold text-graphite-600"
                >
                  {header}
                </p>
              ) : null}
              <div className="flex min-h-16 items-center gap-3 px-4 py-2">
                <span
                  aria-hidden="true"
                  className="hidden size-9 shrink-0 place-items-center rounded-full bg-alabaster-900 text-xs font-semibold text-graphite-600 sm:grid"
                >
                  {initials(entry.studentName)}
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={
                    entry.status === 'ABSENT' || entry.status === 'LATE' ? open : undefined
                  }
                  disabled={!editing}
                  onClick={() => setOpenId(open ? null : entry.id)}
                >
                  <span className="block truncate font-medium">{entry.studentName}</span>
                  {detail || entry.message ? (
                    <span
                      className={`flex items-center gap-1 truncate text-xs ${missingReason ? 'font-medium text-red-700' : 'text-graphite-600'}`}
                    >
                      {entry.message ? (
                        <MessageSquare aria-hidden="true" className="size-3 shrink-0" />
                      ) : null}
                      <span className="truncate">{detail ?? entry.message}</span>
                    </span>
                  ) : null}
                </button>
                {editing ? (
                  <fieldset className="flex shrink-0 gap-1.5" aria-label={entry.studentName}>
                    {(['PRESENT', 'LATE', 'ABSENT'] as const).map((status) => {
                      const on = entry.status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={on}
                          aria-label={attendanceStatusLabel(status, labels)}
                          disabled={busy}
                          onClick={() => mark(entry, status)}
                          className={`grid size-11 place-items-center rounded-full border text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-95 disabled:opacity-60 motion-reduce:transition-none ${on ? markStyles[status].on : 'border-alabaster-700 bg-white text-graphite-600'}`}
                        >
                          {on && status === 'PRESENT' ? (
                            <Check aria-hidden="true" className="size-4" />
                          ) : (
                            markStyles[status].short
                          )}
                        </button>
                      )
                    })}
                  </fieldset>
                ) : (
                  <span className="shrink-0 text-xs text-graphite-600">
                    {attendanceStatusLabel(entry.status, labels)}
                  </span>
                )}
              </div>
              {open && (entry.status === 'ABSENT' || entry.status === 'LATE') ? (
                <div className="space-y-3 px-4 pb-4 sm:pl-16">
                  {entry.status === 'ABSENT' && reasonPicker ? (
                    <AbsenceReasonChips
                      entry={entry}
                      picker={reasonPicker}
                      disabled={busy}
                      onReason={(reason) => onReason(entry.id, reason)}
                    />
                  ) : null}
                  {entry.status === 'LATE' ? (
                    <LateMinutesPicker
                      entry={entry}
                      label={labels.lateMinutes}
                      other={t('list.otherMinutes')}
                      disabled={busy}
                      onChange={(minutes) => onLateMinutes(entry.id, minutes)}
                      onBlur={() => onFieldBlur(entry.id)}
                    />
                  ) : null}
                  {entry.message || noteIds.has(entry.id) ? (
                    <label className="block text-sm font-medium">
                      {labels.message}
                      <textarea
                        className="mt-1 min-h-16 w-full resize-y rounded-xl border border-alabaster bg-white px-3 py-2 text-base font-normal text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={entry.message ?? ''}
                        maxLength={1000}
                        disabled={globalPending}
                        onChange={(event) => onMessage(entry.id, event.target.value)}
                        onBlur={() => onFieldBlur(entry.id)}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-graphite-600 underline underline-offset-4"
                      onClick={() => showNote(entry.id)}
                    >
                      <MessageSquare aria-hidden="true" className="size-4" />
                      {t('list.addNote')}
                    </button>
                  )}
                </div>
              ) : null}
              {pending.has(entry.id) || errors[entry.id] ? (
                <p
                  aria-live="polite"
                  className={`px-4 pb-2 text-xs sm:pl-16 ${errors[entry.id] ? 'text-red-700' : 'text-graphite-600'}`}
                >
                  {errors[entry.id] ? (
                    <>
                      {errors[entry.id]}{' '}
                      <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => onRetry(entry.id)}
                      >
                        {labels.retry}
                      </button>
                    </>
                  ) : (
                    labels.saving
                  )}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {editing ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-alabaster-700 bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-b-2xl sm:border">
          {counts.NOT_RECORDED > 0 ? (
            <button
              type="button"
              disabled={!canFinish}
              onClick={onMarkRemaining}
              className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-medium text-white disabled:opacity-60"
            >
              {t('list.markRemaining', { count: counts.NOT_RECORDED })}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canFinish}
              onClick={onReview}
              className="min-h-12 w-full rounded-xl bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60"
            >
              {t('list.finish', { absent: counts.ABSENT, late: counts.LATE })}
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}

function LateMinutesPicker({
  entry,
  label,
  other,
  disabled,
  onChange,
  onBlur,
}: {
  entry: AttendanceEntry
  label: string
  other: string
  disabled: boolean
  onChange: (minutes: number | null) => void
  onBlur: () => void
}) {
  const preset = LATE_PRESETS.some((value) => value === entry.lateMinutes)
  const [custom, setCustom] = useState(
    !preset && entry.lateMinutes !== null ? String(entry.lateMinutes) : ''
  )
  const [typing, setTyping] = useState(!preset && entry.lateMinutes !== null)
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {LATE_PRESETS.map((minutes) => {
          const selected = !typing && entry.lateMinutes === minutes
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => {
                setTyping(false)
                onChange(selected ? null : minutes)
              }}
              className={`min-h-11 min-w-11 rounded-full border px-3 text-sm tabular-nums ${selected ? 'border-amber-500 bg-amber-50 font-medium text-amber-950' : 'border-alabaster-700 bg-white text-graphite'}`}
            >
              {minutes}
            </button>
          )
        })}
        {typing ? (
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="1440"
            step="1"
            // biome-ignore lint/a11y/noAutofocus: the field opens on an explicit tap of « Autre »
            autoFocus
            aria-label={label}
            value={custom}
            disabled={disabled}
            onChange={(event) => {
              setCustom(event.target.value)
              const minutes = parseLateMinutes(event.target.value)
              if (minutes !== 'invalid') onChange(minutes)
            }}
            onBlur={onBlur}
            className="h-11 w-24 rounded-full border border-amber-500 bg-white px-3 text-base text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTyping(true)}
            className="min-h-11 rounded-full border border-alabaster-700 bg-white px-3 text-sm text-graphite"
          >
            {other}
          </button>
        )}
      </div>
    </fieldset>
  )
}
