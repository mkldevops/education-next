'use client'

import { Button, Card } from '@peaklab/ui'
import { CircleCheck } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from '@/i18n/routing'
import {
  markAllPresentAction,
  openAttendanceAction,
  updateAttendanceEntryAction,
  validateAttendanceAction,
} from '../../../../../_lib/attendance-actions'

type Labels = {
  title: string
  start: string
  allPresent: string
  draft: string
  validate: string
  validated: string
  saveCorrections: string
  validationSuccess: string
  correctionsSaved: string
  savedTitle: string
  returningToTracking: string
  present: string
  late: string
  absent: string
  unrecorded: string
}
type Entry = {
  id: string
  studentName: string
  status: 'NOT_RECORDED' | 'PRESENT' | 'LATE' | 'ABSENT'
}
type Session = { id: string; status: string; entries: Entry[] }

export function AttendancePanel({
  classPeriodId,
  className,
  occurredOn,
  classScheduleSlotId,
  initialSession,
  labels,
}: {
  classPeriodId: string
  className: string
  occurredOn?: string
  classScheduleSlotId: string
  initialSession?: Session
  labels: Labels
}) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(initialSession ?? null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const selectedDate = occurredOn ?? new Date().toISOString().slice(0, 10)
  const isValidated = session?.status === 'VALIDATED'
  useEffect(() => {
    if (!savedMessage) return
    const timeout = window.setTimeout(
      () => router.replace(`/dashboard/attendance?date=${selectedDate}`),
      650
    )
    return () => window.clearTimeout(timeout)
  }, [router, savedMessage, selectedDate])
  const counts = session?.entries.reduce(
    (all, entry) => {
      all[entry.status] += 1
      return all
    },
    { NOT_RECORDED: 0, PRESENT: 0, LATE: 0, ABSENT: 0 }
  )
  const open = () =>
    startTransition(async () => {
      const result = await openAttendanceAction({
        classPeriodId,
        classScheduleSlotId,
        occurredOn: selectedDate,
      })
      if (typeof result !== 'string') setSession(result)
      else setError(result)
    })
  const setEntry = (entryId: string, status: Entry['status']) =>
    startTransition(async () => {
      if (!session) return
      const result = await updateAttendanceEntryAction({ sessionId: session.id, entryId, status })
      if (result === 'OK')
        setSession({
          ...session,
          entries: session.entries.map((entry) =>
            entry.id === entryId ? { ...entry, status } : entry
          ),
        })
      else setError(result)
    })
  const allPresent = () =>
    startTransition(async () => {
      if (!session) return
      const result = await markAllPresentAction({ sessionId: session.id })
      if (result === 'OK')
        setSession({
          ...session,
          entries: session.entries.map((entry) =>
            entry.status === 'NOT_RECORDED' ? { ...entry, status: 'PRESENT' } : entry
          ),
        })
      else setError(result)
    })
  if (savedMessage)
    return (
      <div className="mx-auto flex min-h-[28rem] max-w-lg items-center justify-center px-4">
        <Card
          role="status"
          aria-live="polite"
          className="attendance-success relative w-full overflow-hidden border-success/25 bg-white p-8 text-center shadow-lg"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--color-success)_18%,transparent),transparent_70%)]" />
          <div className="attendance-success-icon relative mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success/10 text-success ring-8 ring-success/5">
            <CircleCheck className="size-9" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="relative text-2xl font-bold text-graphite">{labels.savedTitle}</h1>
          <p className="relative mt-2 text-graphite-600">{savedMessage}</p>
          <p className="relative mt-6 text-sm text-graphite-700">{labels.returningToTracking}</p>
          <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-success/10">
            <span className="attendance-success-progress block h-full origin-left rounded-full bg-success" />
          </div>
        </Card>
      </div>
    )

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">
        {labels.title} — {className}
      </h1>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!session ? (
        <Button onClick={open} disabled={pending}>
          {labels.start}
        </Button>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <p role="status" className="text-sm font-medium">
              {isValidated ? labels.validated : labels.draft}
            </p>
            <p>
              {labels.present}: {counts?.PRESENT} · {labels.late}: {counts?.LATE} · {labels.absent}:{' '}
              {counts?.ABSENT} · {labels.unrecorded}: {counts?.NOT_RECORDED}
            </p>
            <Button onClick={allPresent} disabled={pending}>
              {labels.allPresent}
            </Button>
          </Card>
          {session.entries.map((entry) => (
            <Card
              key={entry.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{entry.studentName}</span>
              <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
                <Button
                  size="sm"
                  variant={entry.status === 'PRESENT' ? 'default' : 'outline'}
                  onClick={() => setEntry(entry.id, 'PRESENT')}
                >
                  {labels.present}
                </Button>
                <Button
                  size="sm"
                  variant={entry.status === 'LATE' ? 'default' : 'outline'}
                  onClick={() => setEntry(entry.id, 'LATE')}
                >
                  {labels.late}
                </Button>
                <Button
                  size="sm"
                  variant={entry.status === 'ABSENT' ? 'default' : 'outline'}
                  onClick={() => setEntry(entry.id, 'ABSENT')}
                >
                  {labels.absent}
                </Button>
              </div>
            </Card>
          ))}
          <Button
            onClick={() =>
              startTransition(async () => {
                if (!session) return
                const wasValidated = session.status === 'VALIDATED'
                const result = await validateAttendanceAction({ sessionId: session.id })
                if (result === 'OK') {
                  setSession({ ...session, status: 'VALIDATED' })
                  setError(null)
                  const successMessage = wasValidated
                    ? labels.correctionsSaved
                    : labels.validationSuccess
                  setSavedMessage(successMessage)
                  toast.success(successMessage)
                } else setError(result)
              })
            }
            disabled={pending}
          >
            {isValidated ? labels.saveCorrections : labels.validate}
          </Button>
        </>
      )}
    </div>
  )
}
