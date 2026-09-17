'use client'

import { Button } from '@peaklab/ui'
import { useState, useTransition } from 'react'
import {
  cancelAttendanceOccurrenceAction,
  setAttendanceCancellationAction,
} from '../../../_lib/attendance-actions'

export function CancelAttendanceForm({
  sessionId,
  cancelled,
  label,
}: {
  sessionId: string
  cancelled: boolean
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setAttendanceCancellationAction({ sessionId, cancelled })
            if (result !== 'OK') setError(result)
          })
        }
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}

export function CancelOccurrenceForm({
  classPeriodId,
  classScheduleSlotId,
  occurredOn,
  label,
}: {
  classPeriodId: string
  classScheduleSlotId: string
  occurredOn: Date
  label: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      className="w-full sm:w-auto"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cancelAttendanceOccurrenceAction({ classPeriodId, classScheduleSlotId, occurredOn })
        })
      }
    >
      {label}
    </Button>
  )
}
