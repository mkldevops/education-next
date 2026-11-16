import { Button } from '@peaklab/ui'
import type { Labels } from './attendance-call-model'

export function AttendanceActionsBar({
  labels,
  validated,
  listView,
  reviewDisabled,
  onCorrect,
  onReview,
}: {
  labels: Labels
  validated: boolean
  listView: boolean
  reviewDisabled: boolean
  onCorrect: () => void
  onReview: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl text-right">
      {validated ? (
        <div className="flex items-center justify-end gap-3">
          {listView ? (
            <p role="status" className="text-sm font-medium text-emerald-800">
              {labels.validatedStatus}
            </p>
          ) : null}
          <Button onClick={onCorrect}>{labels.correctAttendance}</Button>
        </div>
      ) : (
        <Button disabled={reviewDisabled} onClick={onReview}>
          {labels.reviewAttendance}
        </Button>
      )}
    </div>
  )
}
