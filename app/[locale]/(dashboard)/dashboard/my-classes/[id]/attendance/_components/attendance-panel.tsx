'use client'

import { Button, Card } from '@peaklab/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import type { AttendanceEntryMode } from '@/domain/attendance-entry-mode'
import type { AttendanceFrequency } from '@/domain/attendance-frequency'
import { Link, useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import {
  markAllPresentAction,
  refreshAttendanceRosterAction,
  startAdhocAttendanceAction,
  startScheduledAttendanceAction,
  updateAttendanceEntryAction,
  validateAttendanceAction,
} from '../../../../../_lib/attendance-actions'
import { AttendanceList } from './attendance-list'
import styles from './attendance-panel.module.css'
import { AttendanceReview } from './attendance-review'
import {
  type AbsenceReasonOption,
  type AttendanceEntry,
  type AttendanceStatus,
  countAttendanceStatuses,
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
  reviewAttendance: string
  partialWarning: string
  validatePartial: string
  returnToEntry: string
  correctAttendance: string
  returnClasses: string
  validatedStatus: string
  previousStudent: string
  nextStudent: string
  previous: string
  next: string
  studentPosition: string
  saveBeforeContinue: string
  summary: string
  noStudents: string
  reviewSubtitle: string
  completeStudents: string
  partialWarningSingle: string
  completeStudent: string
  all: string
  edit: string
  errors: Record<string, string>
}
type Session = { id: string; status: string; entries: AttendanceEntry[] }
type Slot = { id: string; startTime: string; endTime: string }
type Payload = Pick<AttendanceEntry, 'status' | 'lateMinutes' | 'message' | 'absenceReasonId'>
type DraftUpdate = Partial<Omit<AttendanceEntry, 'id' | 'studentName'>>
const payload = (entry: AttendanceEntry): Payload => ({
  status: entry.status,
  lateMinutes: entry.lateMinutes,
  message: entry.message,
  absenceReasonId: entry.absenceReasonId,
})
const same = (a: Payload, b: Payload) =>
  a.status === b.status &&
  a.lateMinutes === b.lateMinutes &&
  a.message === b.message &&
  (a.absenceReasonId ?? null) === (b.absenceReasonId ?? null)
const errorFor = (result: unknown, labels: Labels) =>
  typeof result === 'string' ? (labels.errors[result] ?? labels.errors.unexpected) : null

export function AttendancePanel({
  frequency = 'PER_SLOT',
  classPeriodId,
  className,
  occurredOn,
  locale,
  slots,
  selectedSlotId,
  selectedOccurrence,
  initialSession,
  returnHref,
  labels,
  entryMode = 'ONE_BY_ONE',
  absenceReasons = [],
  absenceReasonRequired = false,
}: {
  frequency?: AttendanceFrequency
  classPeriodId: string
  className: string
  occurredOn: string
  locale: string
  slots: Slot[]
  selectedSlotId?: string
  selectedOccurrence?: 'adhoc' | 'daily'
  initialSession: Session | null
  returnHref: string
  labels: Labels
  entryMode?: AttendanceEntryMode
  absenceReasons?: AbsenceReasonOption[]
  absenceReasonRequired?: boolean
}) {
  const t = useTranslations('dashboard.pages.attendance')
  const router = useRouter()
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
  const [leaving, setLeaving] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [rosterNotice, setRosterNotice] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(initialSession?.status === 'VALIDATED')
  const [showDateForm, setShowDateForm] = useState(!initialSession)
  const [editing, setEditing] = useState(initialSession?.status !== 'VALIDATED')
  const control = useRef<HTMLButtonElement>(null)
  const review = useRef<HTMLDivElement>(null)
  const entries = session?.entries.map((entry) => drafts[entry.id] ?? entry) ?? []
  const active = entries[index]
  const counts = countAttendanceStatuses(entries)
  const recorded = counts.PRESENT + counts.LATE + counts.ABSENT
  const isUnsaved = (entry: AttendanceEntry) =>
    !same(payload(entry), confirmed.current[entry.id] ?? payload(entry))
  const focusControl = () => setTimeout(() => control.current?.focus())
  const dirty = entries.some(isUnsaved)
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
  const reasonPicker =
    absenceReasons.length > 0 || absenceReasonRequired
      ? {
          options: absenceReasons,
          title: t('reasons.title'),
          missing: absenceReasonRequired ? t('reasons.missing') : undefined,
        }
      : undefined
  const updateDraft = (id: string, update: DraftUpdate) => {
    const entry = draftsRef.current[id]
    if (!entry) return
    const next = { ...entry, ...update }
    if (next.status !== 'LATE') next.lateMinutes = null
    if (next.status !== 'ABSENT' && next.absenceReasonId) {
      next.absenceReasonId = null
      next.absenceReasonLabel = null
    }
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
                item.id === id
                  ? { ...item, ...payload(entry), absenceReasonLabel: entry.absenceReasonLabel }
                  : item
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
  const saveNow = (id: string) => {
    const timer = debounceTimers.current.get(id)
    if (timer) clearTimeout(timer)
    debounceTimers.current.delete(id)
    void save(id)
  }
  const flush = async () =>
    (await Promise.all(entries.filter(isUnsaved).map((entry) => save(entry.id)))).every(Boolean)
  const move = async (next: number) => {
    if (!active || next < 0 || next >= entries.length || globalPending) return
    const result = await save(active.id)
    if (!result && isUnsaved(active)) return
    setForward(next > index)
    setIndex(next)
    focusControl()
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
  const refreshRoster = async () => {
    if (!session || globalLock.current || entryErrors) return
    globalLock.current = true
    setGlobalPending(true)
    setGlobalError(null)
    setRosterNotice(null)
    try {
      if (!(await flush())) return
      const result = await refreshAttendanceRosterAction({ sessionId: session.id })
      if (typeof result === 'string') {
        setGlobalError(errorFor(result, labels))
        return
      }
      // Keep local drafts; only the students added since the opening are new to this screen.
      const added = result.entries.filter((entry) => !draftsRef.current[entry.id])
      const next = {
        ...draftsRef.current,
        ...Object.fromEntries(added.map((entry) => [entry.id, entry])),
      }
      for (const entry of added) confirmed.current[entry.id] = payload(entry)
      setDrafts(next)
      draftsRef.current = next
      const activeId = active?.id
      setSession(result)
      const nextIndex = activeId ? result.entries.findIndex((entry) => entry.id === activeId) : 0
      setIndex(Math.max(nextIndex, 0))
      setRosterNotice(t('rosterRefreshed', { count: added.length }))
    } catch {
      setGlobalError(labels.errors.unexpected)
    } finally {
      globalLock.current = false
      setGlobalPending(false)
    }
  }
  const markRemainingPresent = () => {
    if (!session) return
    void global(
      () => markAllPresentAction({ sessionId: session.id }),
      () => {
        const next = Object.fromEntries(
          entries.map((entry) => [
            entry.id,
            entry.status === 'NOT_RECORDED' ? { ...entry, status: 'PRESENT' as const } : entry,
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
  const chooseReason = (id: string, reason: AbsenceReasonOption | null) => {
    updateDraft(id, {
      absenceReasonId: reason?.id ?? null,
      absenceReasonLabel: reason?.label ?? null,
    })
    void save(id)
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
            className="text-sm text-foreground underline underline-offset-4"
            onClick={() => setShowDateForm((visible) => !visible)}
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
      {frequency !== 'DAILY' && !selectedSlotId && !selectedOccurrence ? (
        <Card className="space-y-3 p-4">
          <p className="font-medium">{labels.selectOccurrence}</p>
          {slots.map((slot) => (
            <Link
              key={slot.id}
              className="block min-h-11 rounded-md border px-3 py-2 text-foreground"
              href={`/dashboard/my-classes/${classPeriodId}/attendance?date=${occurredOn}&slotId=${slot.id}`}
            >
              {labels.schedule}: {slot.startTime}–{slot.endTime}
            </Link>
          ))}
          <Link
            className="block min-h-11 rounded-md border px-3 py-2 text-foreground"
            href={`/dashboard/my-classes/${classPeriodId}/attendance?date=${occurredOn}&occurrence=adhoc`}
          >
            {labels.exceptional}
          </Link>
        </Card>
      ) : !session ? (
        <Button onClick={start} disabled={globalPending}>
          {frequency !== 'DAILY' && selectedOccurrence ? labels.startExceptional : labels.start}
        </Button>
      ) : session.status === 'CANCELLED' ? (
        <Card className="p-4">
          <p role="status">{labels.errors.sessionCancelled}</p>
        </Card>
      ) : (
        <>
          {!reviewing && entryMode === 'LIST' && session.status === 'DRAFT' ? (
            <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={globalPending || pendingEntries || dirty || entryErrors}
                onClick={() => void refreshRoster()}
              >
                {t('refreshRoster')}
              </Button>
              {rosterNotice ? (
                <p role="status" className="text-sm text-graphite-600">
                  {rosterNotice}
                </p>
              ) : null}
            </div>
          ) : null}
          {!reviewing && entryMode !== 'LIST' ? (
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
              {session.status === 'DRAFT' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={globalPending || pendingEntries || dirty || entryErrors}
                    onClick={() => void refreshRoster()}
                  >
                    {t('refreshRoster')}
                  </Button>
                  {rosterNotice ? (
                    <p role="status" className="text-sm text-graphite-600">
                      {rosterNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {editing && counts.NOT_RECORDED > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={globalPending || pendingEntries || dirty || entryErrors}
                  onClick={markRemainingPresent}
                >
                  {t('markRemainingPresent', { count: counts.NOT_RECORDED })}
                </Button>
              ) : null}
            </section>
          ) : null}
          {entries.length === 0 ? (
            <Card className="p-6 text-center text-graphite-600">{labels.noStudents}</Card>
          ) : entryMode === 'LIST' && !reviewing ? (
            <AttendanceList
              entries={entries}
              labels={labels}
              editing={editing}
              pending={pending}
              globalPending={globalPending}
              errors={errors}
              reasonPicker={reasonPicker}
              reasonRequired={absenceReasonRequired}
              onStatus={(id, status) => {
                updateDraft(id, { status })
                void save(id)
              }}
              onReason={chooseReason}
              onLateMinutes={(id, minutes) => {
                updateDraft(id, { lateMinutes: minutes })
                scheduleSave(id)
              }}
              onMessage={(id, message) => {
                updateDraft(id, { message: message || null })
                scheduleSave(id)
              }}
              onFieldBlur={saveNow}
              onRetry={(id) => {
                void save(id)
              }}
              onMarkRemaining={markRemainingPresent}
              onReview={() => setReviewing(true)}
              canFinish={!globalPending && !pendingEntries && !dirty && !entryErrors}
            />
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
                    updateDraft(active.id, { lateMinutes: value })
                    scheduleSave(active.id)
                  }}
                  onMessage={(message) => {
                    updateDraft(active.id, { message: message || null })
                    scheduleSave(active.id)
                  }}
                  onFieldBlur={() => saveNow(active.id)}
                  onRetry={() => {
                    void save(active.id)
                  }}
                  reasonPicker={reasonPicker}
                  onReason={(reason) => chooseReason(active.id, reason)}
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
                        <span>{labels.previous}</span>
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
                        <span>{labels.next}</span>
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                  }
                />
              </div>
            </section>
          ) : null}
          {!reviewing && (entryMode !== 'LIST' || !editing) ? (
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
                labels={labels}
                validated={session.status === 'VALIDATED' && !editing}
                returnHref={returnHref}
                missingReasonsWarning={
                  absenceReasonRequired ? t('reasons.missingWarning') : undefined
                }
                onCorrect={() => {
                  setEditing(true)
                  setReviewing(false)
                  focusControl()
                }}
                onReturn={() => setReviewing(false)}
                onComplete={() => {
                  const first = entries.findIndex((entry) => entry.status === 'NOT_RECORDED')
                  if (first >= 0) {
                    setIndex(first)
                    setReviewing(false)
                    focusControl()
                  }
                }}
                onEdit={(entryId) => {
                  const target = entries.findIndex((entry) => entry.id === entryId)
                  if (target >= 0) {
                    setIndex(target)
                    setReviewing(false)
                    focusControl()
                  }
                }}
                validating={leaving || globalPending || pendingEntries || entryErrors}
                onValidate={() =>
                  void global(
                    () => validateAttendanceAction({ sessionId: session.id }),
                    () => {
                      setLeaving(true)
                      toast.success(labels.validatedStatus)
                      router.push(returnHref)
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
