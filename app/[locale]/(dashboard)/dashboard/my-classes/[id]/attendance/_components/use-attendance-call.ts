import { useTranslations } from 'next-intl'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { AttendanceEntryMode } from '@/domain/attendance-entry-mode'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import {
  markAllPresentAction,
  refreshAttendanceRosterAction,
  startAdhocAttendanceAction,
  startScheduledAttendanceAction,
  updateAttendanceEntryAction,
  validateAttendanceAction,
} from '../../../../../_lib/attendance-actions'
import {
  type DraftUpdate,
  errorFor,
  type Labels,
  type Payload,
  payload,
  type Session,
  same,
} from './attendance-call-model'
import {
  type AbsenceReasonOption,
  type AttendanceEntry,
  countAttendanceStatuses,
} from './student-attendance-card'

export function useAttendanceCall({
  classPeriodId,
  occurredOn,
  selectedSlotId,
  initialSession,
  returnHref,
  labels,
  entryMode,
  absenceReasons,
  absenceReasonRequired,
}: {
  classPeriodId: string
  occurredOn: string
  selectedSlotId?: string
  initialSession: Session | null
  returnHref: string
  labels: Labels
  entryMode: AttendanceEntryMode
  absenceReasons: AbsenceReasonOption[]
  absenceReasonRequired: boolean
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
  const [reviewing, setReviewing] = useState(false)
  const [showDateForm, setShowDateForm] = useState(!initialSession)
  const [editing, setEditing] = useState(initialSession?.status !== 'VALIDATED')
  const control = useRef<HTMLButtonElement>(null)
  const review = useRef<HTMLDivElement>(null)
  const entries = session?.entries.map((entry) => drafts[entry.id] ?? entry) ?? []
  const active = entries[index]
  const listView = entryMode === 'LIST' || (session?.status === 'VALIDATED' && !editing)
  const counts = countAttendanceStatuses(entries)
  const recorded = counts.PRESENT + counts.LATE + counts.ABSENT
  const isUnsaved = (entry: AttendanceEntry) =>
    !same(payload(entry), confirmed.current[entry.id] ?? payload(entry))
  const isSaved = (entry: AttendanceEntry) =>
    saved === entry.id && same(payload(entry), confirmed.current[entry.id])
  const focusControl = () => setTimeout(() => control.current?.focus())
  const dirty = entries.some(isUnsaved)
  const entryErrors = Object.values(errors).some(Boolean)
  const pendingEntries = pending.size > 0
  const blocked = globalPending || pendingEntries || dirty || entryErrors
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
  const submitDateForm = (event: FormEvent<HTMLFormElement>) => {
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
  }
  const toggleDateForm = () => setShowDateForm((visible) => !visible)
  const correct = () => {
    setEditing(true)
    setReviewing(false)
    focusControl()
  }
  const goTo = (target: number) => {
    if (target >= 0) {
      setIndex(target)
      setReviewing(false)
      focusControl()
    }
  }
  const completeMissing = () => goTo(entries.findIndex((entry) => entry.status === 'NOT_RECORDED'))
  const editEntry = (entryId: string) => goTo(entries.findIndex((entry) => entry.id === entryId))
  const validate = () => {
    if (!session) return
    void global(
      () => validateAttendanceAction({ sessionId: session.id }),
      () => {
        setLeaving(true)
        toast.success(labels.validatedStatus)
        router.push(returnHref)
      }
    )
  }
  return {
    session,
    entries,
    active,
    index,
    forward,
    counts,
    recorded,
    listView,
    editing,
    reviewing,
    showDateForm,
    pending,
    errors,
    globalPending,
    globalError,
    rosterNotice,
    leaving,
    pendingEntries,
    entryErrors,
    blocked,
    reasonPicker,
    control,
    review,
    isSaved,
    updateDraft,
    save,
    scheduleSave,
    saveNow,
    move,
    start,
    refreshRoster,
    markRemainingPresent,
    chooseReason,
    submitDateForm,
    toggleDateForm,
    startEditing: () => setEditing(true),
    startReview: () => setReviewing(true),
    stopReview: () => setReviewing(false),
    correct,
    completeMissing,
    editEntry,
    validate,
  }
}
