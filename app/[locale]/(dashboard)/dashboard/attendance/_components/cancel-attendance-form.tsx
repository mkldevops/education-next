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
    <span>
      <Button
        size="sm"
        variant="outline"
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
      {error && <span role="alert">{error}</span>}
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
      size="sm"
      variant="outline"
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
