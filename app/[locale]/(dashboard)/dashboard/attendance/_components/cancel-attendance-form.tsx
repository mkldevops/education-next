'use client'

import { Button } from '@peaklab/ui'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import {
  cancelAttendanceOccurrenceAction,
  setAttendanceCancellationAction,
} from '../../../_lib/attendance-actions'

type ErrorLabels = {
  validationError: string
  notFound: string
  attendanceDisabled: string
  sessionCancelled: string
  unexpected: string
}

function errorMessage(result: unknown, errors: ErrorLabels) {
  return typeof result === 'string' && result in errors
    ? errors[result as keyof ErrorLabels]
    : errors.unexpected
}

type CommonProps = {
  label: string
  pendingLabel: string
  errors: ErrorLabels
}

function CancellationButton({
  run,
  label,
  pendingLabel,
  errors,
}: CommonProps & {
  run: () => Promise<unknown>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const submit = () =>
    startTransition(async () => {
      try {
        const result = await run()
        if (result !== 'OK') {
          setError(errorMessage(result, errors))
          return
        }
        setError(null)
        router.refresh()
      } catch {
        setError(errors.unexpected)
      }
    })
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={pending}
        onClick={submit}
        aria-busy={pending}
      >
        {pending ? pendingLabel : label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}

export function CancelAttendanceForm({
  sessionId,
  cancelled,
  label,
  pendingLabel,
  errors,
}: CommonProps & {
  sessionId: string
  cancelled: boolean
}) {
  return (
    <CancellationButton
      run={() => setAttendanceCancellationAction({ sessionId, cancelled })}
      label={label}
      pendingLabel={pendingLabel}
      errors={errors}
    />
  )
}

export function CancelOccurrenceForm({
  classPeriodId,
  classScheduleSlotId,
  occurredOn,
  label,
  pendingLabel,
  errors,
}: CommonProps & {
  classPeriodId: string
  classScheduleSlotId: string
  occurredOn: Date
}) {
  return (
    <CancellationButton
      run={() =>
        cancelAttendanceOccurrenceAction({ classPeriodId, classScheduleSlotId, occurredOn })
      }
      label={label}
      pendingLabel={pendingLabel}
      errors={errors}
    />
  )
}
