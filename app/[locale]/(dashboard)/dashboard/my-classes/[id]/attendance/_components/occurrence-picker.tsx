import { Card } from '@peaklab/ui'
import { Link } from '@/i18n/routing'
import type { Labels, Slot } from './attendance-call-model'

export function OccurrencePicker({
  labels,
  classPeriodId,
  occurredOn,
  slots,
}: {
  labels: Labels
  classPeriodId: string
  occurredOn: string
  slots: Slot[]
}) {
  return (
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
  )
}
