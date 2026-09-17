'use client'

import { Button, Card } from '@peaklab/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/routing'
import {
  markAllPresentAction,
  startAdhocAttendanceAction,
  startScheduledAttendanceAction,
  updateAttendanceEntryAction,
  validateAttendanceAction,
} from '../../../../../_lib/attendance-actions'
import styles from './attendance-panel.module.css'
import { AttendanceReview } from './attendance-review'
import {
  type AttendanceEntry,
  type AttendanceStatus,
  StudentAttendanceCard,
  type StudentCardLabels,
} from './student-attendance-card'

type Labels = StudentCardLabels & {
  title: string
  start: string
  draft: string
  validate: string
  date: string
  schedule: string
  selectOccurrence: string
  exceptional: string
  startExceptional: string
  changeDate: string
  progress: string
  markRemainingPresent: string
  reviewAttendance: string
  partialWarning: string
  validatePartial: string
  returnToEntry: string
  correctAttendance: string
  returnClasses: string
  validatedStatus: string
  previousStudent: string
  nextStudent: string
  previous?: string
  next?: string
  studentPosition: string
  saveBeforeContinue: string
  summary: string
  noStudents: string
  reviewSubtitle?: string
  completeStudents?: string
  partialWarningSingle: string
  completeStudent: string
  all?: string
  edit?: string
  errors: Record<string, string>
}
type Session = { id: string; status: string; entries: AttendanceEntry[] }
type Slot = { id: string; startTime: string; endTime: string }
type Payload = Pick<AttendanceEntry, 'status' | 'lateMinutes' | 'message'>
const payload = (entry: AttendanceEntry): Payload => ({
  status: entry.status,
  lateMinutes: entry.lateMinutes,
  message: entry.message,
})
const same = (a: Payload, b: Payload) =>
  a.status === b.status && a.lateMinutes === b.lateMinutes && a.message === b.message
const errorFor = (result: unknown, labels: Labels) =>
  typeof result === 'string' ? (labels.errors[result] ?? labels.errors.unexpected) : null

export function AttendancePanel({
  classPeriodId,
  className,
  occurredOn,
  locale,
  slots,
  selectedSlotId,
  selectedOccurrence,
  initialSession,
  labels,
}: {
  classPeriodId: string
  className: string
  occurredOn: string
  locale: string
  slots: Slot[]
  selectedSlotId?: string
  selectedOccurrence?: 'adhoc'
  initialSession: Session | null
  labels: Labels
}) {
  const [session, setSession] = useState<Session | null>(initialSession)
  const [drafts, setDrafts] = useState<Record<string, AttendanceEntry>>(() =>
    Object.fromEntries(initialSession?.entries.map((entry) => [entry.id, entry]) ?? [])
  )
  const draftsRef = useRef(drafts)
  const confirmed = useRef<Record<string, Payload>>(
    Object.fromEntries(initialSession?.entries.map((entry) => [entry.id, payload(entry)]) ?? [])
  )
  const chains = useRef(new Map<string, Promise<boolean>>())
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const globalLock = useRef(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [forward, setForward] = useState(true)
  const [globalPending, setGlobalPending] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(initialSession?.status === 'VALIDATED')
  const [showDateForm, setShowDateForm] = useState(!initialSession)
  const [editing, setEditing] = useState(initialSession?.status !== 'VALIDATED')
  const control = useRef<HTMLButtonElement>(null)
  const review = useRef<HTMLDivElement>(null)
  const entries = session?.entries.map((entry) => drafts[entry.id] ?? entry) ?? []
  const active = entries[index]
  const counts = entries.reduce(
    (all, entry) => {
      all[entry.status] += 1
      return all
    },
    { NOT_RECORDED: 0, PRESENT: 0, LATE: 0, ABSENT: 0 }
  )
  const recorded = counts.PRESENT + counts.LATE + counts.ABSENT
  const dirty = entries.some(
    (entry) => !same(payload(entry), confirmed.current[entry.id] ?? payload(entry))
  )
  const entryErrors = Object.values(errors).some(Boolean)
  const pendingEntries = pending.size > 0
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${occurredOn}T00:00:00.000Z`)
  )
  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])
  useEffect(() => {
    if (reviewing) {
      review.current?.focus()
      if (!editing) review.current?.scrollIntoView?.({ block: 'start' })
    }
  }, [reviewing, editing])
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !pendingEntries) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty, pendingEntries])
  useEffect(
    () => () => {
      debounceTimers.current.forEach((timer) => {
        clearTimeout(timer)
      })
    },
    []
  )
  const updateDraft = (id: string, update: Partial<Payload>) => {
    const entry = draftsRef.current[id]
    if (!entry) return
    const next = { ...entry, ...update }
    if (next.status !== 'LATE') next.lateMinutes = null
    const nextDrafts = { ...draftsRef.current, [id]: next }
    draftsRef.current = nextDrafts
    setDrafts(nextDrafts)
    setErrors((current) => ({ ...current, [id]: '' }))
    setSaved(null)
  }
  const save = (id: string) => {
    if (!session) return Promise.resolve(false)
    const prior = chains.current.get(id) ?? Promise.resolve(true)
    setPending((current) => new Set(current).add(id))
    const job = prior.then(async () => {
      const entry = draftsRef.current[id]
      if (!entry || same(payload(entry), confirmed.current[id] ?? payload(entry))) return true
      try {
        const result = await updateAttendanceEntryAction({
          sessionId: session.id,
          entryId: id,
          ...payload(entry),
        })
        if (result !== 'OK') {
          setErrors((current) => ({
            ...current,
            [id]: errorFor(result, labels) ?? labels.errors.unexpected,
          }))
          return false
        }
        confirmed.current[id] = payload(entry)
        setSession(
          (current) =>
            current && {
              ...current,
              entries: current.entries.map((item) =>
                item.id === id ? { ...item, ...payload(entry) } : item
              ),
            }
        )
        setErrors((current) => ({ ...current, [id]: '' }))
        setSaved(id)
        return true
      } catch {
        setErrors((current) => ({ ...current, [id]: labels.errors.unexpected }))
        return false
      }
    })
    chains.current.set(id, job)
    void job.finally(() => {
      if (chains.current.get(id) === job) {
        chains.current.delete(id)
        setPending((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
      }
    })
    return job
  }
  const scheduleSave = (id: string) => {
    const timer = debounceTimers.current.get(id)
    if (timer) clearTimeout(timer)
    debounceTimers.current.set(
      id,
      setTimeout(() => {
        debounceTimers.current.delete(id)
        void save(id)
      }, 500)
    )
  }
  const flush = async () =>
    (
      await Promise.all(
        entries
          .filter((entry) => !same(payload(entry), confirmed.current[entry.id] ?? payload(entry)))
          .map((entry) => save(entry.id))
      )
    ).every(Boolean)
  const move = async (next: number) => {
    if (!active || next < 0 || next >= entries.length || globalPending) return
    const result = await save(active.id)
    if (!result && !same(payload(active), confirmed.current[active.id] ?? payload(active))) return
    setForward(next > index)
    setIndex(next)
    setTimeout(() => control.current?.focus())
  }
  const start = async () => {
    setGlobalPending(true)
    setGlobalError(null)
    try {
      const result = selectedSlotId
        ? await startScheduledAttendanceAction({
            classPeriodId,
            classScheduleSlotId: selectedSlotId,
            occurredOn,
          })
        : await startAdhocAttendanceAction({ classPeriodId, occurredOn })
      if (typeof result === 'string') setGlobalError(errorFor(result, labels))
      else {
        setSession(result)
        setShowDateForm(false)
        const next = Object.fromEntries(result.entries.map((entry) => [entry.id, entry]))
        setDrafts(next)
        draftsRef.current = next
        confirmed.current = Object.fromEntries(
          result.entries.map((entry) => [entry.id, payload(entry)])
        )
      }
    } catch {
      setGlobalError(labels.errors.unexpected)
    } finally {
      setGlobalPending(false)
    }
  }
  const global = async (action: () => Promise<'OK' | string>, onOk: () => void) => {
    if (!session || globalLock.current || entryErrors) return
    globalLock.current = true
    setGlobalPending(true)
    setGlobalError(null)
    try {
      if (!(await flush())) return
      const result = await action()
      if (result === 'OK') onOk()
      else setGlobalError(errorFor(result, labels))
    } catch {
      setGlobalError(labels.errors.unexpected)
    } finally {
      globalLock.current = false
      setGlobalPending(false)
    }
  }
  const position = labels.studentPosition
    .replace('{current}', String(index + 1))
    .replace('{total}', String(entries.length))
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
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
            className="text-sm text-primary underline underline-offset-4"
            onClick={() => setShowDateForm((visible) => !visible)}
          >
            {labels.changeDate}
          </button>
        </div>
        <p className="mt-2 text-sm text-graphite-600">
          {date}
          {selectedSlot ? ` · ${selectedSlot.startTime}–${selectedSlot.endTime}` : ''}
          {selectedOccurrence ? ` · ${labels.exceptional}` : ''}
        </p>
        {showDateForm ? (
          <form
            method="get"
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              if (!session) return
              event.preventDefault()
              if (globalLock.current) return
              const form = event.currentTarget
              globalLock.current = true
              setGlobalPending(true)
              void flush().then((saved) => {
                if (saved) form.submit()
                else {
                  globalLock.current = false
                  setGlobalPending(false)
                }
              })
            }}
          >
            <label className="text-sm text-graphite-600">
              {labels.date}
              <input
                className="ml-2 h-11 rounded-md border border-graphite-300 bg-white px-2 text-graphite"
                type="date"
                name="date"
                defaultValue={occurredOn}
                disabled={globalPending}
              />
            </label>
            <Button type="submit" size="sm" disabled={globalPending}>
              {labels.changeDate}
            </Button>
          </form>
        ) : null}
      </header>
      {globalError ? (
        <p role="alert" className="text-sm text-red-700">
          {globalError}
        </p>
      ) : null}
      {!selectedSlotId && !selectedOccurrence ? (
        <Card className="space-y-3 p-4">
          <p className="font-medium">{labels.selectOccurrence}</p>
          {slots.map((slot) => (
            <Link
              key={slot.id}
              className="block min-h-11 rounded-md border px-3 py-2 text-primary"
              href={`/dashboard/my-classes/${classPeriodId}/attendance?date=${occurredOn}&slotId=${slot.id}`}
            >
              {labels.schedule}: {slot.startTime}–{slot.endTime}
            </Link>
          ))}
          <Link
            className="block min-h-11 rounded-md border px-3 py-2 text-primary"
            href={`/dashboard/my-classes/${classPeriodId}/attendance?date=${occurredOn}&occurrence=adhoc`}
          >
            {labels.exceptional}
          </Link>
        </Card>
      ) : !session ? (
        <Button onClick={start} disabled={globalPending}>
          {selectedOccurrence ? labels.startExceptional : labels.start}
        </Button>
      ) : session.status === 'CANCELLED' ? (
        <Card className="p-4">
          <p role="status">{labels.errors.sessionCancelled}</p>
        </Card>
      ) : (
        <>
          {!reviewing ? (
            <section className="mx-auto max-w-2xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-graphite-600">
                <p>{session.status === 'VALIDATED' ? labels.validatedStatus : labels.draft}</p>
                <div className="flex gap-1.5">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-900">
                    {counts.PRESENT} {labels.present}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-950">
                    {counts.LATE} {labels.late}
                  </span>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-red-900">
                    {counts.ABSENT} {labels.absent}
                  </span>
                </div>
              </div>
              <p className="text-sm text-graphite-600">
                {labels.progress
                  .replace('{recorded}', String(recorded))
                  .replace('{total}', String(entries.length))}
              </p>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-alabaster-700"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${entries.length ? (recorded / entries.length) * 100 : 0}%` }}
                />
              </div>
              {editing ? (
                <button
                  type="button"
                  className="text-sm text-primary underline underline-offset-4 disabled:text-graphite-600"
                  disabled={
                    globalPending ||
                    pendingEntries ||
                    dirty ||
                    entryErrors ||
                    counts.NOT_RECORDED === 0
                  }
                  onClick={() =>
                    void global(
                      () => markAllPresentAction({ sessionId: session.id }),
                      () => {
                        const next = Object.fromEntries(
                          entries.map((entry) => [
                            entry.id,
                            entry.status === 'NOT_RECORDED'
                              ? { ...entry, status: 'PRESENT' as const }
                              : entry,
                          ])
                        )
                        setDrafts(next)
                        draftsRef.current = next
                        Object.values(next).forEach((entry) => {
                          confirmed.current[entry.id] = payload(entry)
                        })
                      }
                    )
                  }
                >
                  {labels.markRemainingPresent.replace('{count}', String(counts.NOT_RECORDED))}
                </button>
              ) : null}
            </section>
          ) : null}
          {entries.length === 0 ? (
            <Card className="p-6 text-center text-graphite-600">{labels.noStudents}</Card>
          ) : active && !reviewing ? (
            <section aria-label={position} className="mx-auto max-w-2xl">
              <div key={active.id} className={forward ? styles.enterForward : styles.enterBack}>
                <StudentAttendanceCard
                  entry={active}
                  labels={labels}
                  editing={editing}
                  pending={pending.has(active.id)}
                  globalPending={globalPending}
                  error={errors[active.id]}
                  saved={saved === active.id && same(payload(active), confirmed.current[active.id])}
                  inputRef={(node) => {
                    control.current = node
                  }}
                  onStatus={(status: AttendanceStatus) => {
                    updateDraft(active.id, {
                      status,
                      lateMinutes: status === 'LATE' ? active.lateMinutes : null,
                    })
                    void save(active.id)
                  }}
                  onLateMinutes={(value) => {
                    updateDraft(active.id, { lateMinutes: value === '' ? null : Number(value) })
                    scheduleSave(active.id)
                  }}
                  onMessage={(message) => {
                    updateDraft(active.id, { message: message || null })
                    scheduleSave(active.id)
                  }}
                  onMessageBlur={() => {
                    const timer = debounceTimers.current.get(active.id)
                    if (timer) clearTimeout(timer)
                    debounceTimers.current.delete(active.id)
                    void save(active.id)
                  }}
                  onRetry={() => {
                    void save(active.id)
                  }}
                  footer={
                    <div className="grid grid-cols-2 items-center gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="row-start-2 col-start-1 min-h-11 justify-self-start px-1.5 sm:row-start-1"
                        aria-label={labels.previousStudent}
                        disabled={index === 0 || globalPending}
                        onClick={() => void move(index - 1)}
                      >
                        <ChevronLeft aria-hidden="true" />
                        <span>{labels.previous ?? labels.previousStudent}</span>
                      </Button>
                      <span className="row-start-1 col-span-2 col-start-1 text-center text-xs font-medium text-graphite-600 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                        {position}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="row-start-2 col-start-2 min-h-11 justify-self-end px-1.5 sm:row-start-1 sm:col-start-3"
                        aria-label={labels.nextStudent}
                        disabled={index === entries.length - 1 || globalPending}
                        onClick={() => void move(index + 1)}
                      >
                        <span>{labels.next ?? labels.nextStudent}</span>
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                  }
                />
              </div>
            </section>
          ) : null}
          {!reviewing ? (
            <div className="mx-auto max-w-2xl text-right">
              {session.status === 'VALIDATED' && !editing ? (
                <Button onClick={() => setEditing(true)}>{labels.correctAttendance}</Button>
              ) : (
                <Button
                  disabled={globalPending || pendingEntries || entryErrors}
                  onClick={() => setReviewing(true)}
                >
                  {labels.reviewAttendance}
                </Button>
              )}
            </div>
          ) : null}
          {reviewing ? (
            <div ref={review} tabIndex={-1} className="scroll-mt-28 focus:outline-none">
              <AttendanceReview
                entries={entries}
                labels={{
                  ...labels,
                  reviewSubtitle: labels.reviewSubtitle ?? '',
                  partialWarningSingle: labels.partialWarningSingle,
                  completeStudents: labels.completeStudents ?? '',
                  completeStudent: labels.completeStudent,
                  all: labels.all ?? '',
                  edit: labels.edit ?? '',
                  validatedStatus: labels.validatedStatus,
                  correctAttendance: labels.correctAttendance,
                  returnClasses: labels.returnClasses,
                }}
                validated={session.status === 'VALIDATED' && !editing}
                onCorrect={() => {
                  setEditing(true)
                  setReviewing(false)
                  setTimeout(() => control.current?.focus())
                }}
                onReturn={() => setReviewing(false)}
                onComplete={() => {
                  const first = entries.findIndex((entry) => entry.status === 'NOT_RECORDED')
                  if (first >= 0) {
                    setIndex(first)
                    setReviewing(false)
                    setTimeout(() => control.current?.focus())
                  }
                }}
                onEdit={(entryId) => {
                  const target = entries.findIndex((entry) => entry.id === entryId)
                  if (target >= 0) {
                    setIndex(target)
                    setReviewing(false)
                    setTimeout(() => control.current?.focus())
                  }
                }}
                validating={globalPending || pendingEntries || entryErrors}
                onValidate={() =>
                  void global(
                    () => validateAttendanceAction({ sessionId: session.id }),
                    () => {
                      setSession((current) => current && { ...current, status: 'VALIDATED' })
                      setReviewing(true)
                      setEditing(false)
                    }
                  )
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
