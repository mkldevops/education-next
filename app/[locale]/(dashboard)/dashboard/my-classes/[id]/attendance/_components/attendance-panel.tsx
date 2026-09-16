'use client'

import { Button, Card } from '@peaklab/ui'
import { useState, useTransition } from 'react'
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
  present: string
  absent: string
  unrecorded: string
}
type Entry = { id: string; studentName: string; status: 'NOT_RECORDED' | 'PRESENT' | 'ABSENT' }
type Session = { id: string; status: string; entries: Entry[] }

export function AttendancePanel({
  classPeriodId,
  className,
  labels,
}: {
  classPeriodId: string
  className: string
  labels: Labels
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const counts = session?.entries.reduce(
    (all, entry) => {
      all[entry.status] += 1
      return all
    },
    { NOT_RECORDED: 0, PRESENT: 0, ABSENT: 0 }
  )
  const open = () =>
    startTransition(async () => {
      const result = await openAttendanceAction({ classPeriodId, occurredOn: today })
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
            <p className="text-sm font-medium">{session.status}</p>
            <p>
              {labels.present}: {counts?.PRESENT} · {labels.absent}: {counts?.ABSENT} ·{' '}
              {labels.unrecorded}: {counts?.NOT_RECORDED}
            </p>
            <Button onClick={allPresent} disabled={pending}>
              {labels.allPresent}
            </Button>
          </Card>
          {session.entries.map((entry) => (
            <Card key={entry.id} className="flex items-center justify-between gap-2 p-3">
              <span>{entry.studentName}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={entry.status === 'PRESENT' ? 'default' : 'outline'}
                  onClick={() => setEntry(entry.id, 'PRESENT')}
                >
                  {labels.present}
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
                const result = await validateAttendanceAction({ sessionId: session.id })
                if (result === 'OK') setSession({ ...session, status: 'VALIDATED' })
                else setError(result)
              })
            }
            disabled={pending}
          >
            {labels.validate}
          </Button>
        </>
      )}
    </div>
  )
}
